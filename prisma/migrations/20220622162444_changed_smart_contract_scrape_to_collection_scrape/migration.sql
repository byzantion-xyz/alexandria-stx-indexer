/*
  Warnings:

  - You are about to drop the column `smart_contract_scrape_id` on the `smart_contract` table. All the data in the column will be lost.
  - You are about to drop the `smart_contract_scrape` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[collection_scrape_id]` on the table `collection` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CollectionScrapeStage" AS ENUM ('getting_tokens', 'pinning', 'loading_nft_metas', 'updating_rarities', 'creating_collection_attributes', 'done');

-- CreateEnum
CREATE TYPE "CollectionScrapeOutcome" AS ENUM ('skipped', 'succeeded', 'failed');

-- DropForeignKey
ALTER TABLE "smart_contract" DROP CONSTRAINT "smart_contract_smart_contract_scrape_id_fkey";

-- DropIndex
DROP INDEX "smart_contract_smart_contract_scrape_id_key";

-- AlterTable
ALTER TABLE "collection" ADD COLUMN     "collection_scrape_id" UUID;

-- AlterTable
ALTER TABLE "smart_contract" DROP COLUMN "smart_contract_scrape_id";

-- DropTable
DROP TABLE "smart_contract_scrape";

-- DropEnum
DROP TYPE "SmartContractScrapeOutcome";

-- DropEnum
DROP TYPE "SmartContractScrapeStage";

-- CreateTable
CREATE TABLE "collection_scrape" (
    "id" UUID NOT NULL,
    "stage" "CollectionScrapeStage" DEFAULT E'getting_tokens',
    "outcome" "CollectionScrapeOutcome",
    "outcome_msg" TEXT,
    "error" JSONB,
    "collection_id" UUID NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collection_scrape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_scrape_collection_id_key" ON "collection_scrape"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_collection_scrape_id_key" ON "collection"("collection_scrape_id");

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_collection_scrape_id_fkey" FOREIGN KEY ("collection_scrape_id") REFERENCES "collection_scrape"("id") ON DELETE SET NULL ON UPDATE CASCADE;
