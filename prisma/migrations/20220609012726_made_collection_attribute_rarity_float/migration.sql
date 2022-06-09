/*
  Warnings:

  - A unique constraint covering the columns `[collection_id]` on the table `collection_attribute` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "collection_attribute" ALTER COLUMN "rarity" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "collection_attribute_collection_id_key" ON "collection_attribute"("collection_id");
