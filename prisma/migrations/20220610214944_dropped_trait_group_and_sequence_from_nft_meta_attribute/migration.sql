/*
  Warnings:

  - You are about to drop the column `sequence` on the `nft_meta_attribute` table. All the data in the column will be lost.
  - You are about to drop the column `trait_group` on the `nft_meta_attribute` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "nft_meta_attribute" DROP COLUMN "sequence",
DROP COLUMN "trait_group";
