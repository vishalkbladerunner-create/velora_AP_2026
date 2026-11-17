const { Pool } = require('pg');
const prisma = require('../../src/db/prisma');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const pharmacyId = Number(process.argv[2]);

  if (!Number.isInteger(pharmacyId)) {
    console.error('Usage: node course-demos/pg/index.js <pharmacyId>');
    process.exitCode = 1;
    return;
  }

  const result = await pool.query(
    'SELECT * FROM "StockItem" WHERE "pharmacyId" = $1 ORDER BY "id"',
    [pharmacyId]
  );

  console.log('pg rows:', result.rowCount);
  console.log(result.rows[0]);

  const rows = await prisma.stockItem.findMany({
    where: { pharmacyId: pharmacyId },
    select: { id: true },
  });

  console.log('prisma rows:', rows.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
