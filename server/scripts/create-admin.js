// DEVELOPMENT ONLY — create an administrator or promote an existing account.
//
// Usage (from server/):
//   node scripts/create-admin.js 9000000000 "Velora Admin" "Admin@2026!"
const bcrypt = require('bcrypt');
const prisma = require('../src/db/prisma');

const phone = process.argv[2];
const name = process.argv[3];
const password = process.argv[4];
const PHONE_PATTERN = /^[6-9][0-9]{9}$/;

async function main() {
  if (!phone || !name || !password || !PHONE_PATTERN.test(phone) || password.length < 8) {
    throw new Error('Usage: node scripts/create-admin.js <10-digit phone> <name> "<password of 8+ characters>"');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { phone: phone },
    update: { name: name, role: 'ADMIN', passwordHash: passwordHash },
    create: {
      name: name,
      phone: phone,
      address: 'Velora operations',
      passwordHash: passwordHash,
      role: 'ADMIN',
    },
    select: { id: true, name: true, phone: true, role: true },
  });

  console.log('Admin ready: #' + user.id + ' ' + user.name + ' (' + user.phone + ') role=' + user.role);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
