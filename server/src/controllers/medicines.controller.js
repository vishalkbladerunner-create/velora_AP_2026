const prisma = require('../db/prisma');

// Read the :id route parameter; returns null when it is not a whole number.
function readId(req) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return null;
  }

  return id;
}

// GET /medicines and GET /medicines?name=dolo
const getAll = async (req, res) => {
  try {
    const name = req.query.name;

    if (name !== undefined && typeof name !== 'string') {
      res.status(400).json({ error: 'Invalid name parameter' });
      return;
    }

    const where = {};

    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    const medicines = await prisma.medicine.findMany({
      where: where,
      orderBy: { name: 'asc' },
    });

    res.json(medicines);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load medicines' });
  }
};

// GET /medicines/:id
const getById = async (req, res) => {
  try {
    const id = readId(req);

    if (id === null) {
      res.status(400).json({ error: 'Invalid medicine id' });
      return;
    }

    const medicine = await prisma.medicine.findUnique({ where: { id: id } });

    if (!medicine) {
      res.status(404).json({ error: 'Medicine not found' });
      return;
    }

    res.json(medicine);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load the medicine' });
  }
};

// POST /medicines  body: { name, form }  (development only)
const createMedicine = async (req, res) => {
  try {
    // req.body is undefined when no JSON body was sent.
    const body = req.body || {};
    const name = body.name;
    const form = body.form;

    if (!name || !form) {
      res.status(400).json({ error: 'Missing medicine name or form' });
      return;
    }

    // name is @unique: check first so a duplicate is a 400, not a database error.
    const existing = await prisma.medicine.findUnique({ where: { name: name } });

    if (existing) {
      res.status(400).json({ error: 'A medicine with this name already exists' });
      return;
    }

    const medicine = await prisma.medicine.create({
      data: { name: name, form: form },
    });

    res.status(201).json(medicine);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create the medicine' });
  }
};

// PUT /medicines/:id  body: { name, form }  replaces both fields (development only)
const updateMedicine = async (req, res) => {
  try {
    const id = readId(req);

    if (id === null) {
      res.status(400).json({ error: 'Invalid medicine id' });
      return;
    }

    // req.body is undefined when no JSON body was sent.
    const body = req.body || {};
    const name = body.name;
    const form = body.form;

    if (!name || !form) {
      res.status(400).json({ error: 'Missing medicine name or form' });
      return;
    }

    const medicine = await prisma.medicine.findUnique({ where: { id: id } });

    if (!medicine) {
      res.status(404).json({ error: 'Medicine not found' });
      return;
    }

    const sameName = await prisma.medicine.findUnique({ where: { name: name } });

    if (sameName && sameName.id !== id) {
      res.status(400).json({ error: 'A medicine with this name already exists' });
      return;
    }

    const updated = await prisma.medicine.update({
      where: { id: id },
      data: { name: name, form: form },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update the medicine' });
  }
};

// DELETE /medicines/:id  (development only)
const deleteMedicine = async (req, res) => {
  try {
    const id = readId(req);

    if (id === null) {
      res.status(400).json({ error: 'Invalid medicine id' });
      return;
    }

    const medicine = await prisma.medicine.findUnique({ where: { id: id } });

    if (!medicine) {
      res.status(404).json({ error: 'Medicine not found' });
      return;
    }

    // StockItem rows point at this medicine, and the foreign key blocks the delete.
    const stockRows = await prisma.stockItem.findMany({
      where: { medicineId: id },
      select: { id: true },
    });

    if (stockRows.length > 0) {
      res.status(400).json({ error: 'Medicine is still stocked by a pharmacy' });
      return;
    }

    await prisma.medicine.delete({ where: { id: id } });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not delete the medicine' });
  }
};

module.exports = {
  getAll,
  getById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
};
