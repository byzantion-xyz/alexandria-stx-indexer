/*
  Warnings:

  - You are about to drop the column `collectionDataLoadId` on the `collection_bid` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[collection_data_load_id]` on the table `collection` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "collection_bid" DROP CONSTRAINT "collection_bid_collectionDataLoadId_fkey";

-- DropForeignKey
ALTER TABLE "collection_data_load" DROP CONSTRAINT "collection_data_load_collection_id_fkey";

-- AlterTable
ALTER TABLE "collection" ADD COLUMN     "collection_data_load_id" UUID;

-- AlterTable
ALTER TABLE "collection_bid" DROP COLUMN "collectionDataLoadId";

-- CreateIndex
CREATE UNIQUE INDEX "collection_collection_data_load_id_key" ON "collection"("collection_data_load_id");

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_collection_data_load_id_fkey" FOREIGN KEY ("collection_data_load_id") REFERENCES "collection_data_load"("id") ON DELETE SET NULL ON UPDATE CASCADE;
