/*
  Warnings:

  - Made the column `sequence` on table `nft_meta_attribute` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "nft_meta_attribute" ALTER COLUMN "sequence" SET NOT NULL;
