/*
  Warnings:

  - A unique constraint covering the columns `[meta_id,trait_type,value]` on the table `nft_meta_attribute` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "nft_meta_attribute_trait_type_value_meta_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "nft_meta_attribute_meta_id_trait_type_value_key" ON "nft_meta_attribute"("meta_id", "trait_type", "value");
