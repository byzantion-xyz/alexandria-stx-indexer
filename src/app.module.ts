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
    IndexersModule,
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
      name: "NEAR-STREAM",
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        url: config.get("NEAR_STREAMER_SQL_DATABASE_URL"),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [__dirname + "/database/near-stream/entities/*{.ts,.js}"],
        migrations: ["src/database/near-stream/migrations/*{.ts,.js}"],
        subscribers: [],
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      name: "STACKS-STREAM",
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        url: config.get("STACKS_STREAMER_SQL_DATABASE_URL"),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [__dirname + "/database/stacks-stream/entities/*{.ts,.js}"],
        migrations: ["src/database/near-stream/migrations/*{.ts,.js}"],
        subscribers: [],
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
