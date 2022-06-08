import { Module } from '@nestjs/common';
import { DiscordBotController } from './discord-bot.controller';
import { DiscordModule } from '@discord-nestjs/core';
import { ListBotService } from './providers/list-bot.service';
import { BotHelperService } from './providers/bot-helper.service';
import { SalesBotService } from './providers/sales-bot.service';

@Module({
  imports: [
    DiscordModule.forFeature()
  ],
  controllers: [DiscordBotController],
  providers: [ListBotService, BotHelperService, SalesBotService]
})
export class DiscordBotModule {}
