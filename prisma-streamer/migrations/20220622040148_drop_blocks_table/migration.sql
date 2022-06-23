/*
  Warnings:

  - You are about to drop the `block` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `block_hash` to the `transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `block_height` to the `transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `block_timestamp` to the `transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "block_hash" TEXT NOT NULL,
ADD COLUMN     "block_height" BIGINT NOT NULL,
ADD COLUMN     "block_timestamp" BIGINT NOT NULL;

-- DropTable
DROP TABLE "block";
