/*
  Warnings:

  - You are about to drop the column `list_contract` on the `nft_state` table. All the data in the column will be lost.
  - Added the required column `list_contract_id` to the `nft_state` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "nft_state" DROP COLUMN "list_contract",
ADD COLUMN     "list_contract_id" UUID NOT NULL,
ALTER COLUMN "list_tx_index" SET DATA TYPE BIGINT;

-- AddForeignKey
ALTER TABLE "nft_state" ADD CONSTRAINT "nft_state_list_contract_id_fkey" FOREIGN KEY ("list_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
