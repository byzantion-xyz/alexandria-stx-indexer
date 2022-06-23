-- CreateTable
CREATE TABLE "creator" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "twitter" TEXT,
    "discord" TEXT,
    "website" TEXT,
    "collection_id" UUID NOT NULL,

    CONSTRAINT "creator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creator_collection_id_key" ON "creator"("collection_id");

-- AddForeignKey
ALTER TABLE "creator" ADD CONSTRAINT "creator_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
