import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { IndexersModule } from './indexers/indexers.module';
import { CommonModule } from './common/common.module';
import { ScrapersModule } from './scrapers/scrapers.module';
import { DiscordModule } from '@discord-nestjs/core';
import { Intents } from 'discord.js';
import { DiscordBotModule } from './discord-bot/discord-bot.module';
import { DiscordServerModule } from './discord-server/discord-server.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';

import discordConfig from './config/discord.config';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      envFilePath: ['config.env', '.env'], 
      load: [discordConfig, appConfig],
      isGlobal: true
    }),
    ScrapersModule,
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get('NEAR_STREAMER_DATABASE_URL'),
        useNewUrlParser: true
      }),
      connectionName: 'near-streamer',
      inject: [ConfigService]
    }),
    DiscordModule.forRootAsync({
      useFactory: () => ({
        token: 'OTQ1Njk0ODExMTI4NzU0MjA2.YhT47Q.YjzYBqiAa5SlSjJu5Tj6NjTIN68',
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
    TasksModule
  ],
  controllers: [
    AppController
  ],
  providers: [
    AppService
  ]
})
export class AppModule {}
