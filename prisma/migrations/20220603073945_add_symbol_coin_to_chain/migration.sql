/*
  Warnings:

  - Added the required column `symbol` to the `chain` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "chain" ADD COLUMN     "coin" TEXT,
ADD COLUMN     "symbol" TEXT NOT NULL;
