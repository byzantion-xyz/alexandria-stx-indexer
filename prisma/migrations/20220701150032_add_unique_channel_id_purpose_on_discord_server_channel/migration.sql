/*
  Warnings:

  - A unique constraint covering the columns `[discord_server_id,channel_id,purpose]` on the table `discord_server_channel` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "discord_server_channel_discord_server_id_channel_id_purpose_key" ON "discord_server_channel"("discord_server_id", "channel_id", "purpose");
