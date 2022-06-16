/*
  Warnings:

  - You are about to drop the column `attempt` on the `smart_contract_scrape` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "smart_contract_scrape" DROP COLUMN "attempt",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;
