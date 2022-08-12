import { Module } from "@nestjs/common";
import { DiscordBotController } from "./discord-bot.controller";
import { DiscordModule } from "@discord-nestjs/core";
import { ListBotService } from "./providers/list-bot.service";
import { BotHelperService } from "./providers/bot-helper.service";
import { SalesBotService } from "./providers/sales-bot.service";
import { DiscordServerModule } from "src/discord-server/discord-server.module";
import { CryptoRateService } from "./providers/crypto-rate.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoRate } from "src/database/universal/entities/CryptoRate";
import { Action } from "src/database/universal/entities/Action";
import { Collection } from "src/database/universal/entities/Collection";

@Module({
  imports: [DiscordModule.forFeature(), DiscordServerModule, TypeOrmModule.forFeature([CryptoRate, Action, Collection])],
  controllers: [DiscordBotController],
  providers: [ListBotService, BotHelperService, SalesBotService, CryptoRateService],
  exports: [ListBotService, SalesBotService],
})
export class DiscordBotModule {}
