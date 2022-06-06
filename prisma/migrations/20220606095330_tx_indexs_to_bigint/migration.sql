-- AlterTable
ALTER TABLE "action" ALTER COLUMN "tx_index" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "nft_state" ALTER COLUMN "asking_tx_index" SET DATA TYPE BIGINT,
ALTER COLUMN "bid_tx_index" SET DATA TYPE BIGINT,
ALTER COLUMN "staked_tx_index" SET DATA TYPE BIGINT;
