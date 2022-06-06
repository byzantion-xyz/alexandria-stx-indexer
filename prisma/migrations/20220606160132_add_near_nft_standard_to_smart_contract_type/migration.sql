/*
  Warnings:

  - The values [sip009,nep148] on the enum `SmartContractType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SmartContractType_new" AS ENUM ('non_fungible_tokens', 'marketplace', 'staking', 'fungible_tokens', 'bridge');
ALTER TABLE "smart_contract" ALTER COLUMN "type" TYPE "SmartContractType_new" USING ("type"::text::"SmartContractType_new");
ALTER TYPE "SmartContractType" RENAME TO "SmartContractType_old";
ALTER TYPE "SmartContractType_new" RENAME TO "SmartContractType";
DROP TYPE "SmartContractType_old";
COMMIT;
