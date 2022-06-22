/*
  Warnings:

  - The primary key for the `transactions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `block_hash` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `block_height` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `block_timestamp` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `receipt` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `tx_hash` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `tx_receiver_id` on the `transactions` table. All the data in the column will be lost.
  - Added the required column `hash` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "transactions_tx_hash_key";

-- AlterTable
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_pkey",
DROP COLUMN "block_hash",
DROP COLUMN "block_height",
DROP COLUMN "block_timestamp",
DROP COLUMN "id",
DROP COLUMN "receipt",
DROP COLUMN "tx_hash",
DROP COLUMN "tx_receiver_id",
ADD COLUMN     "hash" TEXT NOT NULL,
ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("hash");

-- CreateTable
CREATE TABLE "Block" (
    "hash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "block_height" BIGINT NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "receipt_id" TEXT NOT NULL,
    "receipt" JSONB NOT NULL,
    "execution_outcome" JSONB NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("receipt_id")
);
