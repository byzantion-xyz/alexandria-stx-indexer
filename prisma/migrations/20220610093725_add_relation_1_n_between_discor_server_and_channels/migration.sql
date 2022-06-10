/*
  Warnings:

  - Added the required column `discord_server_id` to the `DiscordServerChannel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DiscordServerChannel" ADD COLUMN     "discord_server_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "DiscordServerChannel" ADD CONSTRAINT "DiscordServerChannel_discord_server_id_fkey" FOREIGN KEY ("discord_server_id") REFERENCES "DiscordServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
