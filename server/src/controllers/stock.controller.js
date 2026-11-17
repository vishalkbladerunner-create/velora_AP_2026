const prisma = require('../db/prisma');

function readId(req) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return null;
  }

  return id;
}

// GET /stock?pharmacyId=1
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

    const pharmacyIdParam = req.query.pharmacyId;

    if (pharmacyIdParam === undefined || typeof pharmacyIdParam !== 'string') {
      res.status(400).json({ error: 'Invalid pharmacy id' });
      return;
    }

    const pharmacyId = Number(pharmacyIdParam);

    if (!Number.isInteger(pharmacyId) || pharmacyId <= 0) {
      res.status(400).json({ error: 'Invalid pharmacy id' });
      return;
    }

    const stock = await prisma.stockItem.findMany({
      where: { pharmacyId: pharmacyId },
      include: { medicine: true },
      orderBy: { id: 'asc' },
    });

    res.json(stock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load stock' });
  }
};

// POST /stock  body: { pharmacyId, medicineId, quantity, pricePaise }  (development only)
const createStock = async (req, res) => {
  try {
    const body = req.body || {};
    const pharmacyId = body.pharmacyId;
    const medicineId = body.medicineId;
    const quantity = body.quantity;
    const pricePaise = body.pricePaise;

    if (!Number.isInteger(pharmacyId) || pharmacyId <= 0 ||
        !Number.isInteger(medicineId) || medicineId <= 0 ||
        !Number.isInteger(quantity) || quantity < 0 ||
        !Number.isInteger(pricePaise) || pricePaise <= 0) {
      res.status(400).json({ error: 'Invalid stock fields' });
      return;
    }

    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });

    if (!pharmacy || !medicine) {
      res.status(404).json({ error: 'Pharmacy or medicine not found' });
      return;
    }

    const existing = await prisma.stockItem.findMany({
      where: { pharmacyId: pharmacyId, medicineId: medicineId },
      take: 1,
    });

    if (existing.length > 0) {
      res.status(400).json({ error: 'Stock row already exists; use PUT to change it' });
      return;
    }

    const row = await prisma.stockItem.create({
      data: {
        pharmacyId: pharmacyId,
        medicineId: medicineId,
        quantity: quantity,
        pricePaise: pricePaise,
        updatedAt: new Date(),
      },
      include: { medicine: true },
    });

    res.status(201).json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create the stock row' });
  }
};

// PUT /stock/:id  body: { quantity, pricePaise }  (development only)
const updateStock = async (req, res) => {
  try {
    const id = readId(req);

    if (id === null) {
      res.status(400).json({ error: 'Invalid stock id' });
      return;
    }

    const body = req.body || {};
    const quantity = body.quantity;
    const pricePaise = body.pricePaise;

    if (!Number.isInteger(quantity) || quantity < 0 ||
        !Number.isInteger(pricePaise) || pricePaise <= 0) {
      res.status(400).json({ error: 'Invalid stock fields' });
      return;
    }

    const existing = await prisma.stockItem.findUnique({ where: { id: id } });

    if (!existing) {
      res.status(404).json({ error: 'Stock row not found' });
      return;
    }

    const row = await prisma.stockItem.update({
      where: { id: id },
      data: {
        quantity: quantity,
        pricePaise: pricePaise,
        updatedAt: new Date(),
      },
      include: { medicine: true },
    });

    res.json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update the stock row' });
  }
};

// DELETE /stock/:id  (development only)
const deleteStock = async (req, res) => {
  try {
    const id = readId(req);

    if (id === null) {
      res.status(400).json({ error: 'Invalid stock id' });
      return;
    }

    const existing = await prisma.stockItem.findUnique({ where: { id: id } });

    if (!existing) {
      res.status(404).json({ error: 'Stock row not found' });
      return;
    }

    await prisma.stockItem.delete({ where: { id: id } });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not delete the stock row' });
  }
};

module.exports = {
  getAll,
  createStock,
  updateStock,
  deleteStock,
};
