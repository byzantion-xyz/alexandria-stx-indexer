-- AlterTable
ALTER TABLE "collection" ADD COLUMN     "smart_contract_id" UUID;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
