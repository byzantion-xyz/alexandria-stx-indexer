/*
  Warnings:

  - A unique constraint covering the columns `[symbol]` on the table `chain` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "chain_symbol_key" ON "chain"("symbol");
