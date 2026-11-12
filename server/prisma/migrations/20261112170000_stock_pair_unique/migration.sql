-- CreateIndex
CREATE UNIQUE INDEX "StockItem_pharmacyId_medicineId_key" ON "StockItem"("pharmacyId", "medicineId");
