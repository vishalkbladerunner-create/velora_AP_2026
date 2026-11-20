const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const prisma = require('../db/prisma');
const audit = require('../services/audit.service');
const oauthService = require('../services/oauth.service');
const runtime = require('../runtime/metrics');
const AppError = require('../utils/AppError');
const { readPagination, buildPage } = require('../utils/pagination');

const PHARMACY_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'];

function csvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);

  if (/[",\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}

const overview = async (req, res) => {
  const results = await prisma.$transaction([
    prisma.pharmacy.count(),
    prisma.pharmacy.count({ where: { status: 'PENDING' } }),
    prisma.user.count(),
    prisma.medicine.count(),
    prisma.stockItem.count(),
    prisma.hold.count({ where: { status: 'ACTIVE' } }),
  ]);

  const recent = await prisma.auditLog.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });

  const nextPending = await prisma.pharmacy.findFirst({
    where: { status: 'PENDING' },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, area: true, licenceNumber: true },
  });

  res.json({
    nextPending: nextPending,
    counts: {
      pharmacies: results[0],
      pendingPharmacies: results[1],
      users: results[2],
      medicines: results[3],
      stockRows: results[4],
      activeHolds: results[5],
    },
    recent: recent,
  });
};

const listPharmacies = async (req, res) => {
  const page = readPagination(req, { defaultLimit: 20 });

  if (!page) {
    throw new AppError(400, 'Invalid pagination parameters');
  }

  const where = {};

  if (req.query.status !== undefined) {
    const status = String(req.query.status).toUpperCase();

    if (PHARMACY_STATUSES.indexOf(status) === -1) {
      throw new AppError(400, 'Invalid pharmacy status');
    }

    where.status = status;
  }

  if (String(req.query.stock) === 'true') {
    where.stock = { some: { quantity: { gt: 0 } } };
  }

  const results = await prisma.$transaction([
    prisma.pharmacy.findMany({
      where: where,
      include: { owner: { select: { id: true, name: true, phone: true } } },
      orderBy: { id: 'asc' },
      skip: page.skip,
      take: page.limit,
    }),
    prisma.pharmacy.count({ where: where }),
  ]);

  res.json(buildPage(results[0], results[1], page.page, page.limit));
};

const updatePharmacyStatus = async (req, res) => {
  const id = Number(req.params.id);
  const status = typeof req.body.status === 'string' ? req.body.status.toUpperCase() : '';

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'Invalid pharmacy id');
  }

  if (PHARMACY_STATUSES.indexOf(status) === -1) {
    throw new AppError(400, 'Status must be PENDING, VERIFIED, REJECTED or SUSPENDED');
  }

  const existing = await prisma.pharmacy.findUnique({ where: { id: id } });

  if (!existing) {
    throw new AppError(404, 'Pharmacy not found');
  }

  const updated = await prisma.pharmacy.update({
    where: { id: id },
    data: { status: status },
  });

  audit.record('admin.pharmacy_status', {
    actorId: req.user.id,
    entity: 'Pharmacy',
    entityId: id,
    metadata: { from: existing.status, to: status },
  });

  res.json(updated);
};

const createPharmacy = async (req, res) => {
  const body = req.body || {};
  const fields = ['name', 'area', 'address', 'phone', 'licenceNumber'];
  const missing = fields.filter((field) => !body[field]);

  if (missing.length > 0) {
    throw new AppError(400, 'Missing pharmacy fields: ' + missing.join(', '));
  }

  const existing = await prisma.pharmacy.findUnique({
    where: { licenceNumber: body.licenceNumber },
  });

  if (existing) {
    throw new AppError(400, 'A pharmacy with this licence number already exists');
  }

  const rows = Array.isArray(body.stock) ? body.stock : [];
  const stockCreate = rows.map((row) => ({
    medicineId: Number(row.medicineId),
    quantity: Number(row.quantity),
    pricePaise: Number(row.pricePaise),
    updatedAt: new Date(),
  }));

  if (stockCreate.some((row) =>
    !Number.isInteger(row.medicineId) || row.medicineId <= 0 ||
    !Number.isInteger(row.quantity) || row.quantity < 0 ||
    !Number.isInteger(row.pricePaise) || row.pricePaise <= 0
  )) {
    throw new AppError(400, 'Each stock row needs a medicine id, a quantity and a price in paise');
  }

  // Nested write: the pharmacy and its first stock rows are created in one
  // statement, so a failure leaves neither behind.
  const pharmacy = await prisma.pharmacy.create({
    data: {
      name: body.name,
      area: body.area,
      address: body.address,
      phone: body.phone,
      licenceNumber: body.licenceNumber,
      status: body.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
      distanceKm: Number.isFinite(Number(body.distanceKm)) ? Number(body.distanceKm) : 2.5,
      ownerId: Number.isInteger(Number(body.ownerId)) ? Number(body.ownerId) : null,
      stock: { create: stockCreate },
    },
    include: { stock: { include: { medicine: true } } },
  });

  audit.record('admin.pharmacy_create', {
    actorId: req.user.id,
    entity: 'Pharmacy',
    entityId: pharmacy.id,
    metadata: { status: pharmacy.status, stockRows: stockCreate.length },
  });

  res.status(201).json(pharmacy);
};

const listUsers = async (req, res) => {
  const page = readPagination(req, { defaultLimit: 20 });

  if (!page) {
    throw new AppError(400, 'Invalid pagination parameters');
  }

  const results = await prisma.$transaction([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        pharmacy: { select: { id: true, name: true, status: true } },
      },
      orderBy: { id: 'asc' },
      skip: page.skip,
      take: page.limit,
    }),
    prisma.user.count(),
  ]);

  res.json(buildPage(results[0], results[1], page.page, page.limit));
};

const listAudit = async (req, res) => {
  const page = readPagination(req, { defaultLimit: 25 });

  if (!page) {
    throw new AppError(400, 'Invalid pagination parameters');
  }

  const results = await prisma.$transaction([
    prisma.auditLog.findMany({
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.limit,
    }),
    prisma.auditLog.count(),
  ]);

  res.json(buildPage(results[0], results[1], page.page, page.limit));
};

const runtimeSnapshot = (req, res) => {
  res.json(runtime.snapshot());
};

const bulkStock = async (req, res) => {
  const body = req.body || {};
  const pharmacyId = Number(body.pharmacyId);
  const rows = body.rows;

  if (!Number.isInteger(pharmacyId) || pharmacyId <= 0) {
    throw new AppError(400, 'Invalid pharmacy id');
  }

  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500) {
    throw new AppError(400, 'rows must contain 1 to 500 stock rows');
  }

  const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });

  if (!pharmacy) {
    throw new AppError(404, 'Pharmacy not found');
  }

  const data = rows.map((row) => ({
    pharmacyId: pharmacyId,
    medicineId: Number(row.medicineId),
    quantity: Number(row.quantity),
    pricePaise: Number(row.pricePaise),
    updatedAt: new Date(),
  }));

  const invalid = data.some((row) =>
    !Number.isInteger(row.medicineId) || row.medicineId <= 0 ||
    !Number.isInteger(row.quantity) || row.quantity < 0 ||
    !Number.isInteger(row.pricePaise) || row.pricePaise <= 0
  );

  if (invalid) {
    throw new AppError(400, 'Each row needs a medicine id, a quantity and a price in paise');
  }

  const ids = data.map((row) => row.medicineId);
  const uniqueIds = Array.from(new Set(ids));
  const medicines = await prisma.medicine.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (medicines.length !== uniqueIds.length) {
    throw new AppError(400, 'One or more medicine ids do not exist');
  }

  const result = await prisma.stockItem.createMany({
    data: data,
    skipDuplicates: true,
  });

  audit.record('admin.stock_bulk_import', {
    actorId: req.user.id,
    entity: 'StockItem',
    entityId: pharmacyId,
    metadata: { requested: data.length, created: result.count },
  });

  res.status(201).json({ requested: data.length, created: result.count, skipped: data.length - result.count });
};

const exportStockCsv = async (req, res) => {
  const rows = await prisma.stockItem.findMany({
    include: {
      pharmacy: { select: { name: true, area: true, status: true } },
      medicine: { select: { name: true, form: true } },
    },
    orderBy: { id: 'asc' },
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="velora-stock.csv"');

  function* lines() {
    yield 'stock_id,pharmacy,area,status,medicine,form,quantity,price_paise\n';

    for (const row of rows) {
      yield [
        row.id,
        csvValue(row.pharmacy.name),
        csvValue(row.pharmacy.area),
        row.pharmacy.status,
        csvValue(row.medicine.name),
        row.medicine.form,
        row.quantity,
        row.pricePaise,
      ].join(',') + '\n';
    }
  }

  await pipeline(Readable.from(lines()), res);
};

const createOAuthClient = async (req, res) => {
  const body = req.body || {};
  const client = await oauthService.createClient({
    name: body.name,
    redirectUris: body.redirectUris,
    scopes: body.scopes,
  });

  if (!client) {
    throw new AppError(400, 'Provide a client name, at least one redirect URI and at least one scope');
  }

  audit.record('oauth.client_create', {
    actorId: req.user.id,
    entity: 'OAuthClient',
    entityId: client.id,
    metadata: { clientId: client.clientId, scopes: client.scopes },
  });

  res.status(201).json(client);
};

const listOAuthClients = async (req, res) => {
  const clients = await prisma.oAuthClient.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(clients.map(oauthService.publicClient));
};

module.exports = {
  overview,
  listPharmacies,
  createPharmacy,
  updatePharmacyStatus,
  listUsers,
  listAudit,
  runtimeSnapshot,
  bulkStock,
  exportStockCsv,
  createOAuthClient,
  listOAuthClients,
};
