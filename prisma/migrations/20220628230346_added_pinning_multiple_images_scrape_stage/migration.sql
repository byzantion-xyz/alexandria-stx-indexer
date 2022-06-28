/*
  Warnings:

  - The values [pinning] on the enum `CollectionScrapeStage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CollectionScrapeStage_new" AS ENUM ('getting_tokens', 'pinning_folder', 'loading_nft_metas', 'updating_rarities', 'creating_collection_attributes', 'pinning_multiple_images', 'done');
ALTER TABLE "collection_scrape" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "collection_scrape" ALTER COLUMN "stage" TYPE "CollectionScrapeStage_new" USING ("stage"::text::"CollectionScrapeStage_new");
ALTER TYPE "CollectionScrapeStage" RENAME TO "CollectionScrapeStage_old";
ALTER TYPE "CollectionScrapeStage_new" RENAME TO "CollectionScrapeStage";
DROP TYPE "CollectionScrapeStage_old";
ALTER TABLE "collection_scrape" ALTER COLUMN "stage" SET DEFAULT 'getting_tokens';
COMMIT;
