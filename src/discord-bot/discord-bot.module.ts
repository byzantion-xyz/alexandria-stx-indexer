import { Module } from '@nestjs/common';
import { DiscordBotController } from './discord-bot.controller';
import { DiscordModule } from '@discord-nestjs/core';
import { ListBotService } from './providers/list-bot.service';
import { BotHelperService } from './providers/bot-helper.service';
import { SalesBotService } from './providers/sales-bot.service';
import { DiscordServerModule } from 'src/discord-server/discord-server.module';
import { CryptoRateService } from './providers/crypto-rate.service';

@Module({
  imports: [
    DiscordModule.forFeature(),
    DiscordServerModule
  ],
  controllers: [DiscordBotController],
  providers: [ListBotService, BotHelperService, SalesBotService, CryptoRateService],
  exports: [
    ListBotService,
    SalesBotService
  ]
})
export class DiscordBotModule {}
