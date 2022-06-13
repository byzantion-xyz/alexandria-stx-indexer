-- DropForeignKey
ALTER TABLE "nft_state" DROP CONSTRAINT "nft_state_list_contract_id_fkey";

-- AlterTable
ALTER TABLE "nft_state" ALTER COLUMN "list_contract_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "nft_state" ADD CONSTRAINT "nft_state_list_contract_id_fkey" FOREIGN KEY ("list_contract_id") REFERENCES "smart_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
