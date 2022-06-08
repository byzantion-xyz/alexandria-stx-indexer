import { Module } from '@nestjs/common';
import { DiscordBotController } from './discord-bot.controller';
import { DiscordModule } from '@discord-nestjs/core';
import { ListBotService } from './providers/list-bot/list-bot.service';

@Module({
  imports: [
    DiscordModule.forFeature()
  ],
  controllers: [DiscordBotController],
  providers: [ListBotService]
})
export class DiscordBotModule {}
