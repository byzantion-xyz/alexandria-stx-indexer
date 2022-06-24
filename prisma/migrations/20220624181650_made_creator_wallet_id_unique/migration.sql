/*
  Warnings:

  - A unique constraint covering the columns `[wallet_id]` on the table `collection_creator` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "collection_creator_wallet_id_key" ON "collection_creator"("wallet_id");
