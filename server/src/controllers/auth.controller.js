const bcrypt = require('bcrypt');
const prisma = require('../db/prisma');

const PHONE_PATTERN = /^[6-9][0-9]{9}$/;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

// POST /auth/register
const register = async (req, res) => {
  try {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (name.length < 2 || !PHONE_PATTERN.test(phone) ||
        password.length < 8 || password.length > 72) {
      res.status(400).json({
        error: 'Provide a name, a 10-digit mobile number, and a password of 8 to 72 characters',
      });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { phone: phone } });

    if (existing) {
      res.status(400).json({ error: 'Phone number already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name,
        phone: phone,
        passwordHash: passwordHash,
      },
      select: { id: true, name: true, phone: true, createdAt: true },
    });

    req.session.userId = user.id;
    res.status(201).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create the account' });
  }
};

// POST /auth/login
const login = async (req, res) => {
  try {
    const body = req.body || {};
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!PHONE_PATTERN.test(phone) || password.length === 0) {
      res.status(401).json({ error: 'Invalid phone or password' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { phone: phone } });

    if (!user) {
      res.status(401).json({ error: 'Invalid phone or password' });
      return;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);

    if (!matches) {
      res.status(401).json({ error: 'Invalid phone or password' });
      return;
    }

    req.session.userId = user.id;
    res.json(publicUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not log in' });
  }
};

// POST /auth/logout
const logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(error);
      res.status(500).json({ error: 'Could not log out' });
      return;
    }

    res.clearCookie('connect.sid');
    res.status(204).send();
  });
};

// GET /auth/me
const me = async (req, res) => {
  try {
    if (!req.session.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, name: true, phone: true, createdAt: true },
    });

    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load the account' });
  }
};

module.exports = {
  register,
  login,
  logout,
  me,
};
