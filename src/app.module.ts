import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { IndexersModule } from "./indexers/indexers.module";
import { CommonModule } from "./common/common.module";
import { ScrapersModule } from "./scrapers/scrapers.module";
import { DiscordModule } from "@discord-nestjs/core";
import { Intents } from "discord.js";
import { DiscordBotModule } from "./discord-bot/discord-bot.module";
import { DiscordServerModule } from "./discord-server/discord-server.module";
import { ScheduleModule } from "@nestjs/schedule";
import { TasksModule } from "./tasks/tasks.module";

import discordConfig from "./config/discord.config";
import appConfig from "./config/app.config";
import indexerConfig from "./config/indexer.config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ["config.env", ".env"],
      load: [discordConfig, appConfig, indexerConfig],
      isGlobal: true,
    }),
    ScrapersModule,
    ScheduleModule.forRoot(),
    DiscordModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        token: config.get("DISCORD_BOT_SECRET"),
        discordClientOptions: {
          intents: [Intents.FLAGS.GUILDS],
        },
      }),
      inject: [ConfigService],
    }),
    IndexersModule.register({ chainSymbol: process.env.CHAIN_SYMBOL }),
    CommonModule,
    DiscordBotModule,
    DiscordServerModule,
    TasksModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        url: config.get("DATABASE_URL"),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [__dirname + "/database/universal/entities/*{.ts,.js}"],
        migrations: ["src/database/universal/migrations/*{.ts,.js}"],
        subscribers: [],
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      name: "CHAIN-STREAM",
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        url: config.get(`${config.get('indexer.chainSymbol').toUpperCase()}_STREAMER_SQL_DATABASE_URL`),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [__dirname + `/database/${config.get('indexer.chainSymbol').toLowerCase()}-stream/entities/*{.ts,.js}`],
        migrations: [`src/database/${config.get('indexer.chainSymbol').toLowerCase()}-stream/migrations/*{.ts,.js}`],
        subscribers: [],
      }),
      inject: [ConfigService],
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
