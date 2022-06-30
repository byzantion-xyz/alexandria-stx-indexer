/*
  Warnings:

  - You are about to drop the `crypto_rates` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "crypto_rates";

-- CreateTable
CREATE TABLE "crypto_rate" (
    "id" UUID NOT NULL,
    "fiat_currency" TEXT NOT NULL,
    "crypto_currency" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crypto_rate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crypto_rates_uk_fiat_crypto" ON "crypto_rate"("fiat_currency", "crypto_currency");
