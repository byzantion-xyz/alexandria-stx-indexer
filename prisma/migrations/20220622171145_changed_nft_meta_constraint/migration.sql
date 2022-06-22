/*
  Warnings:

  - A unique constraint covering the columns `[collection_id,token_id]` on the table `nft_meta` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "nft_meta_smart_contract_id_token_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "nft_meta_collection_id_token_id_key" ON "nft_meta"("collection_id", "token_id");
