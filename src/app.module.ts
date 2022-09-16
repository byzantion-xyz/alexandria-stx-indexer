import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { IndexersModule } from "./indexers/indexers.module";
import { CommonModule } from "./common/common.module";
import { DiscordModule } from "@discord-nestjs/core";
import { Intents } from "discord.js";
import { ScheduleModule } from "@nestjs/schedule";
import { TasksModule } from "./tasks/tasks.module";

import indexerConfig from "./config/indexer.config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ["config.env", ".env"],
      load: [indexerConfig],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    IndexersModule,
    CommonModule,
    TasksModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        url: config.get("DATABASE_URL"),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [__dirname + "/database/universal/entities/*{.ts,.js}"],
        migrations: [__dirname + "/database/universal/migrations/*{.ts,.js}"],
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
