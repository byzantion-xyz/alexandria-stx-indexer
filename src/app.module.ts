import { MiddlewareConsumer, Module, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { IndexersModule } from "./indexers/indexers.module";
import { CommonModule } from "./common/common.module";
import { ScrapersModule } from "./scrapers/scrapers.module";
import { ScheduleModule } from "@nestjs/schedule";
import { TasksModule } from "./tasks/tasks.module";

import appConfig from "./config/app.config";
import indexerConfig from "./config/indexer.config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiProtectMiddleware } from "./common/middleware/apiprotect.middleware";
import { ApiKey } from "./database/universal/entities/ApiKey";
import { OwnershipModule } from './ownership/ownership.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ["config.env", ".env"],
      load: [appConfig, indexerConfig],
      isGlobal: true,
    }),
    ScrapersModule,
    ScheduleModule.forRoot(),
    IndexersModule.register({ chainSymbol: process.env.CHAIN_SYMBOL }),
    CommonModule,
    TasksModule,
    TypeOrmModule.forFeature([ApiKey]),
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
        url: config.get(`${config.get("indexer.chainSymbol").toUpperCase()}_STREAMER_SQL_DATABASE_URL`),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [
          __dirname + `/database/${config.get("indexer.chainSymbol").toLowerCase()}-stream/entities/*{.ts,.js}`,
        ],
        migrations: [`src/database/${config.get("indexer.chainSymbol").toLowerCase()}-stream/migrations/*{.ts,.js}`],
        subscribers: [],
      }),
      inject: [ConfigService],
    }),
    OwnershipModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiProtectMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
