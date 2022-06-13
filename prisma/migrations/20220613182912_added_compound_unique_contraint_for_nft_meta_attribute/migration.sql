/*
  Warnings:

  - A unique constraint covering the columns `[trait_type,value,meta_id]` on the table `nft_meta_attribute` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "nft_meta_attribute_trait_type_value_meta_id_key" ON "nft_meta_attribute"("trait_type", "value", "meta_id");
