import { Module } from "@nestjs/common";
import { IndexerController } from "./indexer.controller";
import { IndexerOrchestratorService } from "./indexer-orchestrator.service";
import { ScrapersModule } from "src/scrapers/scrapers.module";
import { NearIndexerModule } from './near-indexer/near-indexer.module';
import { CommonIndexerModule } from './common/common-indexer.module';
import { StacksIndexerModule } from './stacks-indexer/stacks-indexer.module';
import { ChainModule } from "./chain.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ScrapersModule,
    CommonIndexerModule,
    /* Chain indexer modules */
    ChainModule.register({ chainSymbol: 'Near' }),
    TypeOrmModule.forRootAsync({
      name: "CHAIN-STREAM",
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        url: config.get("CHAIN_STREAMER_SQL_DATABASE_URL"),
        type: "postgres",
        synchronize: false,
        logging: false,
        entities: [__dirname + `/database/${config.get('indexer.chainSymbol').toLowerCase()}-stream/entities/*{.ts,.js}`],
        migrations: [`src/database/${config.get('indexer.chainSymbol').toLowerCase()}-stream/migrations/*{.ts,.js}`],
        subscribers: [],
      }),
      inject: [ConfigService],
    })
    //StacksIndexerModule,
  ],
  controllers: [IndexerController],
  providers: [
    IndexerOrchestratorService 
  ],
  exports: [
    IndexerOrchestratorService,
    TypeOrmModule
  ],
})
export class IndexersModule {}
