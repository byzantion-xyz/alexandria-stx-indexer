-- AlterTable
ALTER TABLE "action" ADD COLUMN     "marketplace_smart_contract_id" UUID;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_marketplace_smart_contract_id_fkey" FOREIGN KEY ("marketplace_smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
