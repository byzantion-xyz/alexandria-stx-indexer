/*
  Warnings:

  - You are about to drop the column `collection_data_load_id` on the `collection` table. All the data in the column will be lost.
  - You are about to drop the `collection_data_load` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[smart_contract_scrape_id]` on the table `smart_contract` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SmartContractScrapeStage" AS ENUM ('getting_tokens_from_chain', 'pinning', 'loading_nft_metas', 'updating_rarities', 'creating_collection_attributes', 'done');

-- CreateEnum
CREATE TYPE "SmartContractScrapeOutcome" AS ENUM ('succeeded', 'failed', 'skipped', 'blacklisted');

-- DropForeignKey
ALTER TABLE "collection" DROP CONSTRAINT "collection_collection_data_load_id_fkey";

-- DropIndex
DROP INDEX "collection_collection_data_load_id_key";

-- AlterTable
ALTER TABLE "collection" DROP COLUMN "collection_data_load_id";

-- AlterTable
ALTER TABLE "smart_contract" ADD COLUMN     "smart_contract_scrape_id" UUID;

-- DropTable
DROP TABLE "collection_data_load";

-- DropEnum
DROP TYPE "CollectionDataLoadOutcome";

-- DropEnum
DROP TYPE "CollectionDataLoadStage";

-- CreateTable
CREATE TABLE "smart_contract_scrape" (
    "id" UUID NOT NULL,
    "stage" "SmartContractScrapeStage" DEFAULT E'getting_tokens_from_chain',
    "outcome" "SmartContractScrapeOutcome",
    "outcome_msg" TEXT,
    "error" JSONB,
    "smart_contract_id" UUID NOT NULL,

    CONSTRAINT "smart_contract_scrape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "smart_contract_scrape_smart_contract_id_key" ON "smart_contract_scrape"("smart_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "smart_contract_smart_contract_scrape_id_key" ON "smart_contract"("smart_contract_scrape_id");

-- AddForeignKey
ALTER TABLE "smart_contract" ADD CONSTRAINT "smart_contract_smart_contract_scrape_id_fkey" FOREIGN KEY ("smart_contract_scrape_id") REFERENCES "smart_contract_scrape"("id") ON DELETE SET NULL ON UPDATE CASCADE;
