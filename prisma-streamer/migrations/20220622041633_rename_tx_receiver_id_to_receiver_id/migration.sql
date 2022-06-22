/*
  Warnings:

  - You are about to drop the column `tx_receiver_id` on the `transaction` table. All the data in the column will be lost.
  - Added the required column `receiver_id` to the `transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transaction" DROP COLUMN "tx_receiver_id",
ADD COLUMN     "receiver_id" TEXT NOT NULL;
