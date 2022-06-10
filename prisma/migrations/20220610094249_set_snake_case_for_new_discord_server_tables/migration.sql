/*
  Warnings:

  - You are about to drop the `DiscordServer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DiscordServerChannel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DiscordServerChannel" DROP CONSTRAINT "DiscordServerChannel_discord_server_id_fkey";

-- DropForeignKey
ALTER TABLE "smart_contract_on_discord_server_channel" DROP CONSTRAINT "smart_contract_on_discord_server_channel_discord_server_ch_fkey";

-- DropTable
DROP TABLE "DiscordServer";

-- DropTable
DROP TABLE "DiscordServerChannel";

-- CreateTable
CREATE TABLE "discord_server" (
    "id" UUID NOT NULL,
    "server_id" BIGINT NOT NULL,
    "server_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "discord_server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_server_channel" (
    "id" UUID NOT NULL,
    "channel_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "DiscordChannelType" NOT NULL,
    "discord_server_id" UUID NOT NULL,

    CONSTRAINT "discord_server_channel_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "discord_server_channel" ADD CONSTRAINT "discord_server_channel_discord_server_id_fkey" FOREIGN KEY ("discord_server_id") REFERENCES "discord_server"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_contract_on_discord_server_channel" ADD CONSTRAINT "smart_contract_on_discord_server_channel_discord_server_ch_fkey" FOREIGN KEY ("discord_server_channel_id") REFERENCES "discord_server_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
