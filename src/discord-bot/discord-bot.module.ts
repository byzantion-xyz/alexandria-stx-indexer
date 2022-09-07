import { Module } from "@nestjs/common";
import { DiscordBotController } from "./discord-bot.controller";
import { DiscordModule } from "@discord-nestjs/core";
import { BotHelperService } from "./providers/bot-helper.service";
import { DiscordServerModule } from "src/discord-server/discord-server.module";
import { CryptoRateService } from "./providers/crypto-rate.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CryptoRate } from "src/database/universal/entities/CryptoRate";
import { Action } from "src/database/universal/entities/Action";
import { Collection } from "src/database/universal/entities/Collection";

@Module({
  imports: [DiscordModule.forFeature(), DiscordServerModule, TypeOrmModule.forFeature([CryptoRate, Action, Collection])],
  controllers: [DiscordBotController],
  providers: [BotHelperService, CryptoRateService],
  exports: [BotHelperService],
})
export class DiscordBotModule {}
