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
import { PrismaModule } from "./prisma/prisma.module";
import { ScheduleModule } from "@nestjs/schedule";
import { TasksModule } from "./tasks/tasks.module";

import discordConfig from "./config/discord.config";
import appConfig from "./config/app.config";
import { TypeOrmModule } from "@nestjs/typeorm";
// import { TypeormModule } from './typeorm/typeorm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ["config.env", ".env"],
      load: [discordConfig, appConfig],
      isGlobal: true,
    }),
    ScrapersModule,
    ScheduleModule.forRoot(),
    DiscordModule.forRootAsync({
      useFactory: () => ({
        token: "OTE2ODQ2OTkyMDUzODk1MjQ5.YawGTQ.fhbb-QbnNJZk6TYOF4YmkPZvMOU",
        discordClientOptions: {
          intents: [Intents.FLAGS.GUILDS],
        },
      }),
    }),
    IndexersModule,
    CommonModule,
    DiscordBotModule,
    DiscordServerModule,
    PrismaModule,
    TasksModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        url: config.get("DATABASE_URL"),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [__dirname + "/entities/*{.ts,.js}"],
        migrations: [],
        subscribers: [],
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      name: 'NEAR-STREAM',
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({   
        url: config.get('NEAR_STREAMER_SQL_DATABASE_URL'),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [__dirname + "/database/near-stream/*{.ts,.js}"],
        migrations: [],
        subscribers: [],
      }),
      inject: [ConfigService]
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
