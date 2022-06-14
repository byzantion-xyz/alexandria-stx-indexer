/*
  Warnings:

  - A unique constraint covering the columns `[smart_contract_id]` on the table `collection` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "collection_smart_contract_id_key" ON "collection"("smart_contract_id");
