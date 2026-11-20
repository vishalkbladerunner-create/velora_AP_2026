const prisma = require('../db/prisma');
const audit = require('../services/audit.service');
const { canCancelHold } = require('../auth/policies');

const HOLD_MINUTES = 30;

// Read the :id route parameter; returns null when it is not a whole number.
function readId(req) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return null;
  }

  return id;
}

// Return expired holds to stock before any hold read or write.
async function expireHolds() {
  const now = new Date();
  const due = await prisma.hold.findMany({
    where: { status: 'ACTIVE', expiresAt: { lte: now } },
    select: { id: true, stockItemId: true, quantity: true },
  });

  for (const hold of due) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.hold.updateMany({
        where: { id: hold.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });

      if (updated.count === 0) {
        return;
      }

      await tx.stockItem.updateMany({
        where: { id: hold.stockItemId },
        data: { quantity: { increment: hold.quantity } },
      });
    });
  }
}

// GET /holds
const getHolds = async (req, res) => {
  try {
    await expireHolds();

    const holds = await prisma.hold.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        stockItem: {
          include: {
            medicine: true,
            pharmacy: { select: { id: true, name: true, area: true } },
          },
        },
      },
    });

    res.json(holds);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load holds' });
  }
};

// POST /holds  body: { stockItemId, quantity }
const createHold = async (req, res) => {
  try {
    await expireHolds();

    const body = req.body || {};
    const stockItemId = body.stockItemId;
    const quantity = body.quantity;

    if (!Number.isInteger(stockItemId) || stockItemId <= 0 ||
        !Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ error: 'Provide a stock item id and a positive quantity' });
      return;
    }

    const stockItem = await prisma.stockItem.findUnique({
      where: { id: stockItemId },
      include: { pharmacy: { select: { status: true } } },
    });

    if (!stockItem || stockItem.pharmacy.status !== 'VERIFIED') {
      res.status(404).json({ error: 'Stock item not found' });
      return;
    }

    if (stockItem.quantity < quantity) {
      res.status(400).json({ error: 'Not enough stock' });
      return;
    }

    const hold = await prisma.$transaction(async (tx) => {
      const updated = await tx.stockItem.updateMany({
        where: { id: stockItemId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });

      if (updated.count === 0) {
        return null;
      }

      return tx.hold.create({
        data: {
          userId: req.user.id,
          stockItemId: stockItemId,
          quantity: quantity,
          expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
        },
        include: {
          stockItem: {
            include: {
              medicine: true,
              pharmacy: { select: { id: true, name: true, area: true } },
            },
          },
        },
      });
    });

    if (!hold) {
      res.status(400).json({ error: 'Not enough stock' });
      return;
    }

    audit.record('hold.create', {
      actorId: req.user.id,
      entity: 'Hold',
      entityId: hold.id,
      metadata: { stockItemId: stockItemId, quantity: quantity, expiresAt: hold.expiresAt },
    });

    res.status(201).json(hold);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create the hold' });
  }
};

// DELETE /holds/:id
const cancelHold = async (req, res) => {
  try {
    await expireHolds();

    const id = readId(req);

    if (id === null) {
      res.status(400).json({ error: 'Invalid hold id' });
      return;
    }

    const hold = await prisma.hold.findUnique({ where: { id: id } });

    if (!hold) {
      res.status(404).json({ error: 'Hold not found' });
      return;
    }

    if (!canCancelHold(req.user, hold)) {
      res.status(403).json({ error: 'Not allowed to change this hold' });
      return;
    }

    if (hold.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Hold is no longer active' });
      return;
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      const updated = await tx.hold.updateMany({
        where: { id: id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });

      if (updated.count === 0) {
        return false;
      }

      await tx.stockItem.updateMany({
        where: { id: hold.stockItemId },
        data: { quantity: { increment: hold.quantity } },
      });

      return true;
    });

    if (!cancelled) {
      res.status(400).json({ error: 'Hold is no longer active' });
      return;
    }

    audit.record('hold.cancel', {
      actorId: req.user.id,
      entity: 'Hold',
      entityId: id,
      metadata: { stockItemId: hold.stockItemId, quantity: hold.quantity },
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not cancel the hold' });
  }
};

module.exports = {
  expireHolds,
  getHolds,
  createHold,
  cancelHold,
};
