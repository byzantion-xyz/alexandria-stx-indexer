-- CreateTable
CREATE TABLE "collection_on_discord_server_channel" (
    "collection_id" UUID NOT NULL,
    "discord_server_channel_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_on_discord_server_channel_collection_id_discord__key" ON "collection_on_discord_server_channel"("collection_id", "discord_server_channel_id");

-- AddForeignKey
ALTER TABLE "collection_on_discord_server_channel" ADD CONSTRAINT "collection_on_discord_server_channel_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_on_discord_server_channel" ADD CONSTRAINT "collection_on_discord_server_channel_discord_server_channe_fkey" FOREIGN KEY ("discord_server_channel_id") REFERENCES "discord_server_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
