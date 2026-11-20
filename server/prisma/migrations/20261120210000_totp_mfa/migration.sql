-- Time-based one-time passwords for multi-factor authentication.
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT,
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
