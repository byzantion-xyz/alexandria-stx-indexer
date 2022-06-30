-- CreateTable
CREATE TABLE "crypto_rates" (
    "id" UUID NOT NULL,
    "fiat_currency" TEXT NOT NULL,
    "crypto_currency" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crypto_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crypto_rates_uk_fiat_crypto" ON "crypto_rates"("fiat_currency", "crypto_currency");
