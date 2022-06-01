-- CreateEnum
CREATE TYPE "CollectionBidStatus" AS ENUM ('active', 'pending', 'cancelled', 'matched');

-- CreateEnum
CREATE TYPE "BidType" AS ENUM ('collection', 'attribute', 'solo');

-- CreateEnum
CREATE TYPE "ActionName" AS ENUM ('list', 'unlist', 'buy');

-- CreateTable
CREATE TABLE "SmartContract" (
    "id" SERIAL NOT NULL,
    "contract_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scanned_transactions" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartContractFunction" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "function_name" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "smart_contract_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartContractFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" SERIAL NOT NULL,
    "commission_key" TEXT NOT NULL,
    "custodial" BOOLEAN NOT NULL,
    "amount" INTEGER,
    "smart_contract_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chain" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" SERIAL NOT NULL,
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

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionBid" (
    "id" SERIAL NOT NULL,
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
    "smart_contract_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NftMeta" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "namespace" TEXT,
    "image" TEXT NOT NULL,
    "token_id" INTEGER NOT NULL,
    "rarity" INTEGER,
    "ranking" INTEGER NOT NULL,
    "burned" BOOLEAN NOT NULL DEFAULT false,
    "asset_name" TEXT,
    "grouping" TEXT,
    "spec" TEXT,
    "collection_id" INTEGER NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "smart_contract_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NftMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NftMetaBns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "meta_id" INTEGER NOT NULL,

    CONSTRAINT "NftMetaBns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" SERIAL NOT NULL,
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
    "smart_contract_id" INTEGER,
    "nft_meta_id" INTEGER,
    "collection_id" INTEGER,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmartContract_contract_key_key" ON "SmartContract"("contract_key");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_commission_key_key" ON "Commission"("commission_key");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_smart_contract_id_key" ON "Commission"("smart_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "NftMetaBns_meta_id_key" ON "NftMetaBns"("meta_id");

-- AddForeignKey
ALTER TABLE "SmartContract" ADD CONSTRAINT "SmartContract_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartContractFunction" ADD CONSTRAINT "SmartContractFunction_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "SmartContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "SmartContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionBid" ADD CONSTRAINT "CollectionBid_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "SmartContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMeta" ADD CONSTRAINT "NftMeta_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "SmartContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMeta" ADD CONSTRAINT "NftMeta_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMeta" ADD CONSTRAINT "NftMeta_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMetaBns" ADD CONSTRAINT "NftMetaBns_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "NftMeta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "SmartContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_nft_meta_id_fkey" FOREIGN KEY ("nft_meta_id") REFERENCES "NftMeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
