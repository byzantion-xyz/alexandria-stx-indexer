/*
  Warnings:

  - Made the column `list_price` on table `nft_state` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "action" ALTER COLUMN "list_price" SET DATA TYPE DECIMAL(32,0);

-- AlterTable
ALTER TABLE "nft_state" ALTER COLUMN "list_price" SET NOT NULL,
ALTER COLUMN "list_price" SET DATA TYPE DECIMAL(32,0);
