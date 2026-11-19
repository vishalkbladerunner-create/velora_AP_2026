-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" TEXT NOT NULL DEFAULT 'CUSTOMER';

-- Existing accounts were created before the type selector; keep the current
-- owner able to register a pharmacy by marking them as a pharmacy account.
UPDATE "User" SET "accountType" = 'PHARMACY';
