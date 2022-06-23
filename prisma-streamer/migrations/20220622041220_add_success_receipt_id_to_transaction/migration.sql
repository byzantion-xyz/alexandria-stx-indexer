/*
  Warnings:

  - Added the required column `success_receipt_id` to the `transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tx_receiver_id` to the `transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "success_receipt_id" TEXT NOT NULL,
ADD COLUMN     "tx_receiver_id" TEXT NOT NULL;
