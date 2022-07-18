ALTER TABLE "public".commission ALTER COLUMN smart_contract_id DROP NOT NULL;
DROP INDEX "public".commission_smart_contract_id_key;