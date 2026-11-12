// DEVELOPMENT ONLY — fills a local PostgreSQL with demo medicines, pharmacies
// and stock. Never run this against a shared or production database.
//
// Usage (from server/):
//   node prisma/dev-seed.js              seeds everything
//   node prisma/dev-seed.js medicines    one table only
//   node prisma/dev-seed.js pharmacies
//   node prisma/dev-seed.js stock        needs medicines and pharmacies first
//
// Safe to run twice: every row is looked up first and only created when absent.
const fs = require('fs');
const path = require('path');
const prisma = require('../src/db/prisma');

const datasets = ['all', 'medicines', 'pharmacies', 'stock'];
const dataset = process.argv[2] || 'all';
const dataDir = path.join(__dirname, 'data');

async function readJson(fileName) {
  const raw = await fs.promises.readFile(path.join(dataDir, fileName), 'utf8');
  return JSON.parse(raw);
}

async function seedMedicines() {
  const medicines = await readJson('medicines.json');
  let created = 0;

  for (const medicine of medicines) {
    const existing = await prisma.medicine.findUnique({
      where: { name: medicine.name },
    });

    if (!existing) {
      await prisma.medicine.create({
        data: { name: medicine.name, form: medicine.form },
      });
      created = created + 1;
    }
  }

  console.log('medicines: ' + created + ' created, ' + (medicines.length - created) + ' already there');
}

async function seedPharmacies() {
  const pharmacies = await readJson('pharmacies.json');
  let created = 0;

  for (const pharmacy of pharmacies) {
    const existing = await prisma.pharmacy.findUnique({
      where: { licenceNumber: pharmacy.licenceNumber },
    });

    if (!existing) {
      await prisma.pharmacy.create({
        data: {
          name: pharmacy.name,
          area: pharmacy.area,
          address: pharmacy.address,
          phone: pharmacy.phone,
          licenceNumber: pharmacy.licenceNumber,
          status: pharmacy.status,
        },
      });
      created = created + 1;
    }
  }

  console.log('pharmacies: ' + created + ' created, ' + (pharmacies.length - created) + ' already there');
}

async function seedStock() {
  const rows = await readJson('stock.json');
  let created = 0;

  for (const row of rows) {
    // Stock rows point at a pharmacy by licence number and a medicine by name,
    // so the JSON never depends on auto-increment ids.
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { licenceNumber: row.licenceNumber },
    });
    const medicine = await prisma.medicine.findUnique({
      where: { name: row.medicine },
    });

    if (!pharmacy || !medicine) {
      throw new Error(
        'Stock row needs pharmacy ' + row.licenceNumber + ' and medicine ' + row.medicine +
        '. Seed medicines and pharmacies first.'
      );
    }

    // The schema has @@unique([pharmacyId, medicineId]), so the compound key
    // can be used directly for this check-then-create.
    const existingRow = await prisma.stockItem.findUnique({
      where: {
        pharmacyId_medicineId: {
          pharmacyId: pharmacy.id,
          medicineId: medicine.id,
        },
      },
    });

    if (!existingRow) {
      await prisma.stockItem.create({
        data: {
          pharmacyId: pharmacy.id,
          medicineId: medicine.id,
          quantity: row.quantity,
          pricePaise: row.pricePaise,
          updatedAt: new Date(),
        },
      });
      created = created + 1;
    }
  }

  console.log('stock: ' + created + ' created, ' + (rows.length - created) + ' already there');
}

async function printCounts() {
  const medicines = await prisma.medicine.count();
  const pharmacies = await prisma.pharmacy.count();
  const stock = await prisma.stockItem.count();

  console.log('totals: Medicine ' + medicines + ', Pharmacy ' + pharmacies + ', StockItem ' + stock);
}

async function main() {
  if (!datasets.includes(dataset)) {
    throw new Error('Unknown dataset "' + dataset + '". Use one of: ' + datasets.join(', '));
  }

  if (dataset === 'all' || dataset === 'medicines') {
    await seedMedicines();
  }

  if (dataset === 'all' || dataset === 'pharmacies') {
    await seedPharmacies();
  }

  if (dataset === 'all' || dataset === 'stock') {
    await seedStock();
  }

  await printCounts();
}

main()
  .catch((error) => {
    console.error('Seed failed: ' + error.message);
    process.exitCode = 1;
  })
  // $disconnect is a client lifecycle call, not a CRUD operation: it closes
  // the connection pool so the script can exit.
  .finally(() => prisma.$disconnect());
