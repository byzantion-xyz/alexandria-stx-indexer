/*
  Warnings:

  - Changed the type of `bid_price` on the `collection_bid` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "action" ALTER COLUMN "list_price" SET DATA TYPE BIGINT,
ALTER COLUMN "bid_price" DROP NOT NULL,
ALTER COLUMN "bid_price" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "collection_bid" DROP COLUMN "bid_price",
ADD COLUMN     "bid_price" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "nft_state" ALTER COLUMN "list_price" SET DATA TYPE BIGINT,
ALTER COLUMN "asking_price" SET DATA TYPE BIGINT,
ALTER COLUMN "bid_price" SET DATA TYPE BIGINT;
