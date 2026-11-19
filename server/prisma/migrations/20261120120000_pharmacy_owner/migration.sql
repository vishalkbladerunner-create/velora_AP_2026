-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "ownerId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_ownerId_key" ON "Pharmacy"("ownerId");

-- AddForeignKey
ALTER TABLE "Pharmacy" ADD CONSTRAINT "Pharmacy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
