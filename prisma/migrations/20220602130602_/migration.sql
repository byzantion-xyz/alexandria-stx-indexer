-- CreateEnum
CREATE TYPE "CollectionBidStatus" AS ENUM ('active', 'pending', 'cancelled', 'matched');

-- CreateEnum
CREATE TYPE "BidType" AS ENUM ('collection', 'attribute', 'solo');

-- CreateEnum
CREATE TYPE "ActionName" AS ENUM ('list', 'unlist', 'buy');

-- CreateEnum
CREATE TYPE "SmartContractType" AS ENUM ('sip009', 'marketplace', 'staking', 'fungible_tokens', 'bridge');

-- CreateTable
CREATE TABLE "smart_contract" (
    "id" UUID NOT NULL,
    "contract_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scanned_transactions" INTEGER NOT NULL DEFAULT 0,
    "type" "SmartContractType" NOT NULL,
    "chain_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smart_contract_function" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "function_name" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "smart_contract_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_contract_function_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission" (
    "id" UUID NOT NULL,
    "commission_key" TEXT NOT NULL,
    "custodial" BOOLEAN NOT NULL,
    "amount" INTEGER,
    "smart_contract_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection" (
    "id" UUID NOT NULL,
    "asset_name" TEXT NOT NULL,
    "collection_size" INTEGER,
    "description" TEXT,
    "external_url" TEXT,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "floor" INTEGER NOT NULL DEFAULT 0,
    "cover_image" TEXT,
    "trending" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_attribute" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "rarity" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "collection_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_bid" (
    "id" UUID NOT NULL,
    "token_id" TEXT NOT NULL,
    "token_id_list" TEXT[],
    "nonce" INTEGER NOT NULL,
    "bid_contract_nonce" TEXT NOT NULL,
    "bid_price" TEXT NOT NULL,
    "bid_buyer" TEXT NOT NULL,
    "bid_seller" TEXT NOT NULL,
    "status" "CollectionBidStatus" NOT NULL DEFAULT E'active',
    "pending_txs" TEXT[],
    "pending_tx" TEXT NOT NULL,
    "tx_id" TEXT NOT NULL,
    "block_height" INTEGER NOT NULL,
    "match_tx_id" TEXT NOT NULL,
    "cancel_tx_id" TEXT NOT NULL,
    "bid_type" "BidType" NOT NULL,
    "smart_contract_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_meta" (
    "id" UUID NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "namespace" TEXT,
    "image" TEXT NOT NULL,
    "token_id" INTEGER NOT NULL,
    "rarity" INTEGER,
    "ranking" INTEGER NOT NULL,
    "asset_name" TEXT,
    "grouping" TEXT,
    "spec" TEXT,
    "collection_id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "smart_contract_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_meta_attribute" (
    "id" UUID NOT NULL,
    "trait_type" TEXT NOT NULL,
    "trait_group" TEXT,
    "value" TEXT,
    "rarity" INTEGER NOT NULL DEFAULT 0,
    "sequence" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "meta_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_meta_attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_state" (
    "id" UUID NOT NULL,
    "burned" BOOLEAN NOT NULL DEFAULT false,
    "minted" BOOLEAN NOT NULL DEFAULT false,
    "mint_tx" TEXT NOT NULL,
    "listed" BOOLEAN NOT NULL DEFAULT false,
    "list_price" INTEGER NOT NULL,
    "list_seller" TEXT NOT NULL,
    "list_block_height" INTEGER NOT NULL,
    "list_tx_index" INTEGER NOT NULL,
    "list_contract" TEXT NOT NULL,
    "asking" BOOLEAN NOT NULL DEFAULT false,
    "asking_price" INTEGER NOT NULL,
    "asking_block_height" INTEGER NOT NULL,
    "asking_tx_index" INTEGER NOT NULL,
    "asking_seller" TEXT NOT NULL,
    "bid" BOOLEAN NOT NULL DEFAULT false,
    "bid_price" INTEGER NOT NULL,
    "bid_buyer" TEXT NOT NULL,
    "bid_contract" TEXT NOT NULL,
    "bid_block_height" INTEGER NOT NULL,
    "bid_tx_index" INTEGER NOT NULL,
    "staked" BOOLEAN NOT NULL DEFAULT false,
    "staking_contract" TEXT NOT NULL,
    "staked_owner" TEXT NOT NULL,
    "staked_block_height" INTEGER NOT NULL,
    "staked_tx_index" INTEGER NOT NULL,
    "meta_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_meta_bns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "meta_id" UUID NOT NULL,

    CONSTRAINT "nft_meta_bns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action" (
    "id" UUID NOT NULL,
    "action" "ActionName" NOT NULL,
    "bid_attribute" JSONB,
    "list_price" INTEGER,
    "seller" TEXT,
    "buyer" TEXT,
    "bid_price" INTEGER NOT NULL,
    "block_height" INTEGER NOT NULL,
    "tx_index" INTEGER NOT NULL,
    "block_time" TIMESTAMP(3) NOT NULL,
    "tx_id" TEXT NOT NULL,
    "segment" BOOLEAN NOT NULL DEFAULT false,
    "market_name" TEXT,
    "nonce" INTEGER,
    "units" INTEGER,
    "smart_contract_id" UUID,
    "nft_meta_id" UUID,
    "collection_id" UUID,

    CONSTRAINT "action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "smart_contract_contract_key_key" ON "smart_contract"("contract_key");

-- CreateIndex
CREATE UNIQUE INDEX "commission_commission_key_key" ON "commission"("commission_key");

-- CreateIndex
CREATE UNIQUE INDEX "commission_smart_contract_id_key" ON "commission"("smart_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "nft_meta_attribute_meta_id_key" ON "nft_meta_attribute"("meta_id");

-- CreateIndex
CREATE UNIQUE INDEX "nft_state_meta_id_key" ON "nft_state"("meta_id");

-- CreateIndex
CREATE UNIQUE INDEX "nft_meta_bns_meta_id_key" ON "nft_meta_bns"("meta_id");

-- AddForeignKey
ALTER TABLE "smart_contract" ADD CONSTRAINT "smart_contract_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_contract_function" ADD CONSTRAINT "smart_contract_function_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission" ADD CONSTRAINT "commission_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_attribute" ADD CONSTRAINT "collection_attribute_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_bid" ADD CONSTRAINT "collection_bid_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_meta" ADD CONSTRAINT "nft_meta_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_meta" ADD CONSTRAINT "nft_meta_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_meta" ADD CONSTRAINT "nft_meta_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_meta_attribute" ADD CONSTRAINT "nft_meta_attribute_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "nft_meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_state" ADD CONSTRAINT "nft_state_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "nft_meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_meta_bns" ADD CONSTRAINT "nft_meta_bns_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "nft_meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_nft_meta_id_fkey" FOREIGN KEY ("nft_meta_id") REFERENCES "nft_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
