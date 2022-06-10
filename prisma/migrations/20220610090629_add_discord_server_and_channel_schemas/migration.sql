-- CreateEnum
CREATE TYPE "DiscordChannelType" AS ENUM ('sales', 'listings', 'bids');

-- CreateTable
CREATE TABLE "DiscordServer" (
    "id" UUID NOT NULL,
    "server_id" BIGINT NOT NULL,
    "server_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DiscordServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordServerChannel" (
    "id" UUID NOT NULL,
    "channel_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "DiscordChannelType" NOT NULL,

    CONSTRAINT "DiscordServerChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smart_contract_on_discord_server_channel" (
    "smart_contract_id" UUID NOT NULL,
    "discord_server_channel_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "smart_contract_on_discord_server_channel_smart_contract_id__key" ON "smart_contract_on_discord_server_channel"("smart_contract_id", "discord_server_channel_id");

-- AddForeignKey
ALTER TABLE "smart_contract_on_discord_server_channel" ADD CONSTRAINT "smart_contract_on_discord_server_channel_smart_contract_id_fkey" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_contract_on_discord_server_channel" ADD CONSTRAINT "smart_contract_on_discord_server_channel_discord_server_ch_fkey" FOREIGN KEY ("discord_server_channel_id") REFERENCES "DiscordServerChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
