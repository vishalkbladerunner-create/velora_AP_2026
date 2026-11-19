const config = require('../config/env');
const prisma = require('../db/prisma');

// Read the :id route parameter; returns null when it is not a whole number.
function readId(req) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return null;
  }

  return id;
}

// Keep the internal owner id out of the public pharmacy responses.
function withoutOwner(pharmacy) {
  const copy = { ...pharmacy };
  delete copy.ownerId;
  return copy;
}

// GET /pharmacies?medicine=dolo&area=Sector 14
// Search path: verified pharmacies holding a matching medicine with quantity > 0.
// Each pharmacy carries only the stock rows that matched the search.
async function searchByMedicine(medicine, area) {
  const medicines = await prisma.medicine.findMany({
    where: { name: { contains: medicine, mode: 'insensitive' } },
  });

  if (medicines.length === 0) {
    return [];
  }

  const medicineIds = medicines.map((row) => row.id);
  const pharmacyWhere = { status: 'VERIFIED' };

  if (area) {
    pharmacyWhere.area = { equals: area, mode: 'insensitive' };
  }

  const stockRows = await prisma.stockItem.findMany({
    where: {
      medicineId: { in: medicineIds },
      quantity: { gt: 0 },
      pharmacy: pharmacyWhere,
    },
    include: { pharmacy: true, medicine: true },
    orderBy: { pricePaise: 'asc' },
  });

  // Group the stock rows by pharmacy, keeping the cheapest-first order.
  const byPharmacy = new Map();

  stockRows.forEach((row) => {
    if (!byPharmacy.has(row.pharmacyId)) {
      byPharmacy.set(row.pharmacyId, { ...withoutOwner(row.pharmacy), stock: [] });
    }

    const stockRow = { ...row };
    delete stockRow.pharmacy;
    byPharmacy.get(row.pharmacyId).stock.push(stockRow);
  });

  return Array.from(byPharmacy.values());
}

const getAll = async (req, res) => {
  try {
    // Express 5 keeps bracket syntax as a literal key, so reject it explicitly.
    const keys = Object.keys(req.query);

    for (const key of keys) {
      if (key.indexOf('[') !== -1 || key.indexOf(']') !== -1) {
        res.status(400).json({ error: 'Invalid query parameter: ' + key });
        return;
      }
    }

    const medicine = req.query.medicine;
    const area = req.query.area;

    if (medicine !== undefined && typeof medicine !== 'string') {
      res.status(400).json({ error: 'Invalid medicine parameter' });
      return;
    }

    if (area !== undefined && typeof area !== 'string') {
      res.status(400).json({ error: 'Invalid area parameter' });
      return;
    }

    if (medicine) {
      const pharmacies = await searchByMedicine(medicine, area);
      res.json(pharmacies);
      return;
    }

    const where = { status: 'VERIFIED' };

    if (area) {
      where.area = { equals: area, mode: 'insensitive' };
    }

    const pharmacies = await prisma.pharmacy.findMany({
      where: where,
      include: { stock: { include: { medicine: true } } },
      orderBy: { name: 'asc' },
    });

    res.json(pharmacies.map(withoutOwner));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load pharmacies' });
  }
};

// GET /pharmacies/:id  one pharmacy with all of its stock and each medicine
const getById = async (req, res) => {
  try {
    const id = readId(req);

    if (id === null) {
      res.status(400).json({ error: 'Invalid pharmacy id' });
      return;
    }

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: id },
      include: { stock: { include: { medicine: true } } },
    });

    if (!pharmacy || pharmacy.status !== 'VERIFIED') {
      res.status(404).json({ error: 'Pharmacy not found' });
      return;
    }

    res.json(withoutOwner(pharmacy));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load the pharmacy' });
  }
};

// Shared create path. The route decides the status and owner; the request body
// never does.
async function createPharmacyWithStatus(req, res, status, ownerId) {
  try {
    // req.body is undefined when no JSON body was sent.
    const body = req.body || {};
    const fields = ['name', 'area', 'address', 'phone', 'licenceNumber'];
    const missing = fields.filter((field) => !body[field]);

    if (missing.length > 0) {
      res.status(400).json({ error: 'Missing pharmacy fields: ' + missing.join(', ') });
      return;
    }

    // licenceNumber is @unique: check first so a duplicate is a 400.
    const existing = await prisma.pharmacy.findUnique({
      where: { licenceNumber: body.licenceNumber },
    });

    if (existing) {
      res.status(400).json({ error: 'A pharmacy with this licence number already exists' });
      return;
    }

    const pharmacy = await prisma.pharmacy.create({
      data: {
        name: body.name,
        area: body.area,
        address: body.address,
        phone: body.phone,
        licenceNumber: body.licenceNumber,
        status: status,
        ownerId: ownerId,
      },
    });

    res.status(201).json(pharmacy);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create the pharmacy' });
  }
}

// GET /pharmacies/mine  (session required)
const getMine = async (req, res) => {
  try {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { ownerId: req.session.userId },
    });

    if (!pharmacy) {
      res.status(404).json({ error: 'No pharmacy registered' });
      return;
    }

    res.json(pharmacy);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load your pharmacy' });
  }
};

// POST /pharmacies/mine  body: { name, area, address, phone, licenceNumber }
// One pharmacy per account. Development auto-verifies it so the owner can stock
// and search it; production would need a real verification workflow.
const registerMyPharmacy = async (req, res) => {
  try {
    const existing = await prisma.pharmacy.findUnique({
      where: { ownerId: req.session.userId },
    });

    if (existing) {
      res.status(400).json({ error: 'This account already registered a pharmacy' });
      return;
    }

    const status = config.nodeEnv === 'production' ? 'PENDING' : 'VERIFIED';
    return createPharmacyWithStatus(req, res, status, req.session.userId);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not register the pharmacy' });
  }
};

// POST /pharmacies  body: { name, area, address, phone, licenceNumber }  (development only)
// The public create route starts every pharmacy as PENDING and unowned.
const createPharmacy = (req, res) => {
  return createPharmacyWithStatus(req, res, 'PENDING', null);
};

module.exports = {
  getAll,
  getById,
  getMine,
  registerMyPharmacy,
  createPharmacy,
};
