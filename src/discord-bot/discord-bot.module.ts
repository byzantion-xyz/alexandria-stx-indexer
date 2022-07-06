import { Module } from '@nestjs/common';
import { DiscordBotController } from './discord-bot.controller';
import { DiscordModule } from '@discord-nestjs/core';
import { ListBotService } from './providers/list-bot.service';
import { BotHelperService } from './providers/bot-helper.service';
import { SalesBotService } from './providers/sales-bot.service';
import { DiscordServerModule } from 'src/discord-server/discord-server.module';
import { CryptoRateService } from './providers/crypto-rate.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoRate } from 'src/entities/CryptoRate';
import { Action } from 'src/entities/Action';

@Module({
  imports: [
    DiscordModule.forFeature(),
    DiscordServerModule,
    TypeOrmModule.forFeature([CryptoRate, Action])
  ],
  controllers: [DiscordBotController],
  providers: [ListBotService, BotHelperService, SalesBotService, CryptoRateService],
  exports: [
    ListBotService,
    SalesBotService
  ]
})
export class DiscordBotModule {}
