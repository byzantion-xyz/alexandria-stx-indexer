/*
  Warnings:

  - A unique constraint covering the columns `[smart_contract_id,token_id]` on the table `nft_meta` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "nft_meta_smart_contract_id_token_id_key" ON "nft_meta"("smart_contract_id", "token_id");
