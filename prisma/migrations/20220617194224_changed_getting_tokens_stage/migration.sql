/*
  Warnings:

  - The values [getting_tokens_from_chain,getting_tokens_from_paras] on the enum `SmartContractScrapeStage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SmartContractScrapeStage_new" AS ENUM ('getting_tokens', 'pinning', 'loading_nft_metas', 'updating_rarities', 'creating_collection_attributes', 'done');
ALTER TABLE "smart_contract_scrape" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "smart_contract_scrape" ALTER COLUMN "stage" TYPE "SmartContractScrapeStage_new" USING ("stage"::text::"SmartContractScrapeStage_new");
ALTER TYPE "SmartContractScrapeStage" RENAME TO "SmartContractScrapeStage_old";
ALTER TYPE "SmartContractScrapeStage_new" RENAME TO "SmartContractScrapeStage";
DROP TYPE "SmartContractScrapeStage_old";
ALTER TABLE "smart_contract_scrape" ALTER COLUMN "stage" SET DEFAULT 'getting_tokens';
COMMIT;

-- AlterTable
ALTER TABLE "smart_contract_scrape" ALTER COLUMN "stage" SET DEFAULT E'getting_tokens';
