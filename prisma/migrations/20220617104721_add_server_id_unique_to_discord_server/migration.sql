/*
  Warnings:

  - A unique constraint covering the columns `[server_id]` on the table `discord_server` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "discord_server" ALTER COLUMN "server_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "discord_server_channel" ALTER COLUMN "channel_id" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "discord_server_server_id_key" ON "discord_server"("server_id");
