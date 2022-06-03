/*
  Warnings:

  - A unique constraint covering the columns `[function_name,smart_contract_id]` on the table `smart_contract_function` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "smart_contract_function_function_name_smart_contract_id_key" ON "smart_contract_function"("function_name", "smart_contract_id");
