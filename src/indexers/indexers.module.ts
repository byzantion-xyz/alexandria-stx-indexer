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
    //StacksIndexerModule,
  ],
  controllers: [IndexerController],
  providers: [
    IndexerOrchestratorService 
  ],
  exports: [
    IndexerOrchestratorService
  ],
})
export class IndexersModule {}
