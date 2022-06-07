-- DropForeignKey
ALTER TABLE "nft_meta" DROP CONSTRAINT "nft_meta_collection_id_fkey";

-- AlterTable
ALTER TABLE "nft_meta" ALTER COLUMN "collection_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "nft_meta" ADD CONSTRAINT "nft_meta_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
