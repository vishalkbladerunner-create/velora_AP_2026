// DEVELOPMENT ONLY — fills a local PostgreSQL with demo medicines, pharmacies
// and stock. Never run this against a shared or production database.
//
// Usage (from server/):
//   node prisma/dev-seed.js              seeds everything
//   node prisma/dev-seed.js medicines    one table only
//   node prisma/dev-seed.js pharmacies
//   node prisma/dev-seed.js stock        needs medicines and pharmacies first
//
// Safe to run twice: medicines and pharmacies are upserted, and stock rows use
// createMany with skipDuplicates, so a second run changes nothing.
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

  for (const medicine of medicines) {
    await prisma.medicine.upsert({
      where: { name: medicine.name },
      update: { form: medicine.form },
      create: { name: medicine.name, form: medicine.form },
    });
  }

  console.log('medicines: ' + medicines.length + ' upserted');
}

async function seedPharmacies() {
  const pharmacies = await readJson('pharmacies.json');

  for (const pharmacy of pharmacies) {
    await prisma.pharmacy.upsert({
      where: { licenceNumber: pharmacy.licenceNumber },
      update: {},
      create: {
        name: pharmacy.name,
        area: pharmacy.area,
        address: pharmacy.address,
        phone: pharmacy.phone,
        licenceNumber: pharmacy.licenceNumber,
        status: pharmacy.status,
        distanceKm: pharmacy.distanceKm || 2.5,
      },
    });
  }

  console.log('pharmacies: ' + pharmacies.length + ' upserted');
}

async function seedStock() {
  const rows = await readJson('stock.json');
  const pharmacies = await prisma.pharmacy.findMany({
    select: { id: true, licenceNumber: true },
  });
  const medicines = await prisma.medicine.findMany({
    select: { id: true, name: true },
  });

  const pharmacyByLicence = new Map(pharmacies.map((row) => [row.licenceNumber, row.id]));
  const medicineByName = new Map(medicines.map((row) => [row.name, row.id]));

  const data = rows.map((row) => {
    const pharmacyId = pharmacyByLicence.get(row.licenceNumber);
    const medicineId = medicineByName.get(row.medicine);

    if (!pharmacyId || !medicineId) {
      throw new Error(
        'Stock row needs pharmacy ' + row.licenceNumber + ' and medicine ' + row.medicine +
        '. Seed medicines and pharmacies first.'
      );
    }

    return {
      pharmacyId: pharmacyId,
      medicineId: medicineId,
      quantity: row.quantity,
      pricePaise: row.pricePaise,
      updatedAt: new Date(),
    };
  });

  const result = await prisma.stockItem.createMany({
    data: data,
    skipDuplicates: true,
  });

  console.log('stock: ' + result.count + ' created, ' + (data.length - result.count) + ' already there');
}

async function printCounts() {
  const medicines = await prisma.medicine.count();
  const pharmacies = await prisma.pharmacy.count();
  const stock = await prisma.stockItem.count();

  console.log('totals: Medicine ' + medicines + ', Pharmacy ' + pharmacies + ', StockItem ' + stock);
}

async function main() {
  if (datasets.includes(dataset) === false) {
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
