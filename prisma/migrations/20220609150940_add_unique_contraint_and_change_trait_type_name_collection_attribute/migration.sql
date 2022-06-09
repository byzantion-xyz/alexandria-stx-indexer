/*
  Warnings:

  - You are about to drop the column `name` on the `collection_attribute` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[collection_id,trait_type,value]` on the table `collection_attribute` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `trait_type` to the `collection_attribute` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "collection_attribute" DROP COLUMN "name",
ADD COLUMN     "trait_type" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "collection_attribute_collection_id_trait_type_value_key" ON "collection_attribute"("collection_id", "trait_type", "value");
