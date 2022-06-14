/*
  Warnings:

  - You are about to drop the `CollectionDataLoad` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CollectionDataLoad" DROP CONSTRAINT "CollectionDataLoad_collection_id_fkey";

-- AlterTable
ALTER TABLE "collection_bid" ADD COLUMN     "collectionDataLoadId" UUID;

-- DropTable
DROP TABLE "CollectionDataLoad";

-- CreateTable
CREATE TABLE "collection_data_load" (
    "id" UUID NOT NULL,
    "stage" "CollectionDataLoadStage" DEFAULT E'getting_tokens_from_chain',
    "outcome" "CollectionDataLoadOutcome",
    "outcome_msg" TEXT,
    "error" JSONB,
    "collection_id" UUID NOT NULL,

    CONSTRAINT "collection_data_load_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_data_load_collection_id_key" ON "collection_data_load"("collection_id");

-- AddForeignKey
ALTER TABLE "collection_bid" ADD CONSTRAINT "collection_bid_collectionDataLoadId_fkey" FOREIGN KEY ("collectionDataLoadId") REFERENCES "collection_data_load"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_data_load" ADD CONSTRAINT "collection_data_load_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
