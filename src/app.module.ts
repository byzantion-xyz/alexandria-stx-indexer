import {
  Logger,
  MiddlewareConsumer,
  Module,
  OnApplicationBootstrap,
  OnModuleInit,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { IndexersModule } from "./indexers/indexers.module";
import { CommonModule } from "./common/common.module";
import { ScheduleModule } from "@nestjs/schedule";
import { TasksModule } from "./tasks/tasks.module";

import appConfig from "./config/app.config";
import indexerConfig from "./config/indexer.config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKey } from "./database/universal/entities/ApiKey";
import { DataSource, Migration } from "typeorm";
import { AppDataSource } from "./config/data.source";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ["config.env", ".env"],
      load: [appConfig, indexerConfig],
      isGlobal: true,
    }),
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
        migrations: [__dirname + "/database/universal/migrations/*{.ts,.js}"],
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  async onModuleInit(): Promise<void> {
    // Run migrations. Requires datasource to be connected, so force connect
    const dataSource = await AppDataSource.initialize();
    await this.runMigrations(dataSource);
  }

  async runMigrations(ds: DataSource): Promise<Migration[]> {
    try {
      this.logger.log("Migrations: Checking for pending migrations and attempting to run...");
      const migrations: Migration[] = await ds.runMigrations();
      this.logger.log(`Migrations: Done. Migrations ran successfully.`);
      return migrations;
    } catch (err) {
      this.logger.error("Run migrations failed. Processing stopped.");
      this.logger.error(err);
      process.exit(1);
    }
  }
}
