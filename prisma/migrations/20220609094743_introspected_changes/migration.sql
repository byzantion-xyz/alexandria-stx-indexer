-- DropIndex
DROP INDEX "nft_meta_attribute_trait_type_value_key";

-- AlterTable
ALTER TABLE "collection_attribute" ALTER COLUMN "rarity" SET DATA TYPE DOUBLE PRECISION;
