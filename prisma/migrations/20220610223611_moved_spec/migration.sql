/*
  Warnings:

  - You are about to drop the column `spec` on the `nft_meta` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "nft_meta" DROP COLUMN "spec";

-- AlterTable
ALTER TABLE "smart_contract" ADD COLUMN     "spec" TEXT;
