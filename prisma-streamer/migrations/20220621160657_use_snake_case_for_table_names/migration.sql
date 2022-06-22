/*
  Warnings:

  - You are about to drop the `Block` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Receipt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Block";

-- DropTable
DROP TABLE "Receipt";

-- DropTable
DROP TABLE "transactions";

-- CreateTable
CREATE TABLE "transaction" (
    "hash" TEXT NOT NULL,
    "outcome" JSONB NOT NULL,
    "transaction" JSONB NOT NULL,
    "missing" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "block" (
    "hash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "block_height" BIGINT NOT NULL,

    CONSTRAINT "block_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "receipt" (
    "receipt_id" TEXT NOT NULL,
    "receipt" JSONB NOT NULL,
    "execution_outcome" JSONB NOT NULL,

    CONSTRAINT "receipt_pkey" PRIMARY KEY ("receipt_id")
);
