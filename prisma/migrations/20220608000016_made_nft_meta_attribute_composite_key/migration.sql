/*
  Warnings:

  - A unique constraint covering the columns `[trait_type,value]` on the table `nft_meta_attribute` will be added. If there are existing duplicate values, this will fail.
  - Made the column `value` on table `nft_meta_attribute` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "nft_meta_attribute" ALTER COLUMN "value" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "nft_meta_attribute_trait_type_value_key" ON "nft_meta_attribute"("trait_type", "value");
