-- Velora database schema for PostgreSQL 15 or newer.
-- Mirrors server/prisma/migrations/ and the normalized relations in
-- 01_normalization.md. Run this file top-to-bottom on an empty database.

CREATE TABLE "Medicine" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "form" TEXT NOT NULL,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pharmacy" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockItem" (
    "id" SERIAL NOT NULL,
    "pharmacyId" INTEGER NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "pricePaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- Natural keys. These are the keys the normalization analysis relies on.
CREATE UNIQUE INDEX "Medicine_name_key" ON "Medicine"("name");
CREATE UNIQUE INDEX "Pharmacy_licenceNumber_key" ON "Pharmacy"("licenceNumber");

-- One stock row per pharmacy-medicine pair. This is the key that 2NF
-- identified; without it the pair could appear twice.
CREATE UNIQUE INDEX "StockItem_pharmacyId_medicineId_key"
    ON "StockItem"("pharmacyId", "medicineId");

-- Stock rows must point at a real pharmacy and a real medicine. Deleting a
-- parent is restricted so a stock row can never be orphaned.
ALTER TABLE "StockItem"
    ADD CONSTRAINT "StockItem_pharmacyId_fkey"
    FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockItem"
    ADD CONSTRAINT "StockItem_medicineId_fkey"
    FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
