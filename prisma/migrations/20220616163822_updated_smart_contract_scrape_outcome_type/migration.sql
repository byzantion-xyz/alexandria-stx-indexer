/*
  Warnings:

  - The values [skipped,blacklisted] on the enum `SmartContractScrapeOutcome` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SmartContractScrapeOutcome_new" AS ENUM ('succeeded', 'failed');
ALTER TABLE "smart_contract_scrape" ALTER COLUMN "outcome" TYPE "SmartContractScrapeOutcome_new" USING ("outcome"::text::"SmartContractScrapeOutcome_new");
ALTER TYPE "SmartContractScrapeOutcome" RENAME TO "SmartContractScrapeOutcome_old";
ALTER TYPE "SmartContractScrapeOutcome_new" RENAME TO "SmartContractScrapeOutcome";
DROP TYPE "SmartContractScrapeOutcome_old";
COMMIT;
