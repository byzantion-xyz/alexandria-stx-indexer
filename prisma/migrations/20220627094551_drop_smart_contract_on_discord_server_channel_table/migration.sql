/*
  Warnings:

  - You are about to drop the `smart_contract_on_discord_server_channel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "smart_contract_on_discord_server_channel" DROP CONSTRAINT "smart_contract_on_discord_server_channel_discord_server_ch_fkey";

-- DropForeignKey
ALTER TABLE "smart_contract_on_discord_server_channel" DROP CONSTRAINT "smart_contract_on_discord_server_channel_smart_contract_id_fkey";

-- DropTable
DROP TABLE "smart_contract_on_discord_server_channel";
