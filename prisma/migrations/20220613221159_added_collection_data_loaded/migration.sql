-- CreateEnum
CREATE TYPE "CollectionDataLoadStage" AS ENUM ('getting_tokens_from_chain', 'pinning', 'loading_nft_metas', 'updating_rarities', 'creating_collection_attributes', 'done');

-- CreateEnum
CREATE TYPE "CollectionDataLoadOutcome" AS ENUM ('succeeded', 'failed', 'skipped', 'blacklisted');

-- CreateTable
CREATE TABLE "CollectionDataLoad" (
    "id" UUID NOT NULL,
    "stage" "CollectionDataLoadStage" NOT NULL DEFAULT E'getting_tokens_from_chain',
    "outcome" "CollectionDataLoadOutcome",
    "outcome_msg" TEXT,
    "error" JSONB,
    "collection_id" UUID NOT NULL,

    CONSTRAINT "CollectionDataLoad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionDataLoad_collection_id_key" ON "CollectionDataLoad"("collection_id");

-- AddForeignKey
ALTER TABLE "CollectionDataLoad" ADD CONSTRAINT "CollectionDataLoad_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
