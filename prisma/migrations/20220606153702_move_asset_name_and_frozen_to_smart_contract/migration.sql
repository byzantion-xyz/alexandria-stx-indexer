/*
  Warnings:

  - You are about to drop the column `asset_name` on the `collection` table. All the data in the column will be lost.
  - You are about to drop the column `frozen` on the `collection` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "SmartContractType" ADD VALUE 'nep148';

-- AlterTable
ALTER TABLE "collection" DROP COLUMN "asset_name",
DROP COLUMN "frozen";

-- AlterTable
ALTER TABLE "smart_contract" ADD COLUMN     "asset_name" TEXT,
ADD COLUMN     "frozen" BOOLEAN NOT NULL DEFAULT false;
