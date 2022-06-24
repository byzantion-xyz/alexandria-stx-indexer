/*
  Warnings:

  - You are about to drop the `creator` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "creator" DROP CONSTRAINT "creator_collection_id_fkey";

-- DropTable
DROP TABLE "creator";

-- CreateTable
CREATE TABLE "collection_creator" (
    "id" UUID NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "name" TEXT,
    "bio" TEXT,
    "twitter" TEXT,
    "discord" TEXT,
    "website" TEXT,
    "collection_id" UUID NOT NULL,

    CONSTRAINT "collection_creator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_creator_collection_id_key" ON "collection_creator"("collection_id");

-- AddForeignKey
ALTER TABLE "collection_creator" ADD CONSTRAINT "collection_creator_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
