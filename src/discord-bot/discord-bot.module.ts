import { Module } from '@nestjs/common';
import { DiscordBotController } from './discord-bot.controller';
import { DiscordModule } from '@discord-nestjs/core';
import { ListBotService } from './providers/list-bot/list-bot.service';
import { BotHelperService } from './providers/bot-helper/bot-helper.service';

@Module({
  imports: [
    DiscordModule.forFeature()
  ],
  controllers: [DiscordBotController],
  providers: [ListBotService, BotHelperService]
})
export class DiscordBotModule {}
