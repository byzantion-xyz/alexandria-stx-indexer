-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "outcome" JSONB NOT NULL,
    "transaction" JSONB NOT NULL,
    "receipt" JSONB NOT NULL,
    "block_hash" TEXT NOT NULL,
    "block_timestamp" BIGINT NOT NULL,
    "block_height" BIGINT NOT NULL,
    "tx_receiver_id" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "missing" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tx_hash_key" ON "transactions"("tx_hash");
