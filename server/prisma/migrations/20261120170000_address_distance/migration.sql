-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 2.5;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT;

-- Demo distances for the seeded Sonipat pharmacies. These are not GPS
-- measurements; they exist so the distance label has sample data.
UPDATE "Pharmacy"
SET "distanceKm" = CASE "id"
    WHEN 1 THEN 1.2
    WHEN 2 THEN 2.4
    WHEN 3 THEN 3.6
    WHEN 4 THEN 4.8
    WHEN 5 THEN 5.3
    WHEN 6 THEN 6.1
    ELSE 2.5
END;
