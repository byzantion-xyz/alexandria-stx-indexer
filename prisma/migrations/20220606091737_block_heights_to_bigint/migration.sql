-- AlterTable
ALTER TABLE "action" ALTER COLUMN "block_height" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "collection_bid" ALTER COLUMN "block_height" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "nft_state" ALTER COLUMN "list_block_height" SET DATA TYPE BIGINT,
ALTER COLUMN "asking_block_height" SET DATA TYPE BIGINT,
ALTER COLUMN "bid_block_height" SET DATA TYPE BIGINT,
ALTER COLUMN "staked_block_height" SET DATA TYPE BIGINT;
