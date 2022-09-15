import { DynamicModule, Module } from "@nestjs/common";
import { IndexerController } from "./indexer.controller";
import { ScrapersModule } from "src/scrapers/scrapers.module";
import { NearIndexerModule } from "./near-indexer/near-indexer.module";
import { CommonIndexerModule } from "./common/common-indexer.module";
import { StacksIndexerModule } from "./stacks-indexer/stacks-indexer.module";
import { IndexerOrchestratorService } from "./indexer-orchestrator.service";
import { ConfigModule } from "@nestjs/config";
import { ApiKey } from "src/database/universal/entities/ApiKey";
import { TypeOrmModule } from "@nestjs/typeorm";

interface ChainOptions {
  chainSymbol: string;
}

@Module({})
export class IndexersModule {
  // configure(consumer: MiddlewareConsumer) {
  //   consumer
  //     .apply(ApiProtectMiddleware)
  //     .forRoutes(
  //       { path: "indexer/run", method: RequestMethod.POST },
  //       { path: "indexer/run-missing", method: RequestMethod.POST }
  //     );
  // }

  static register(options: ChainOptions): DynamicModule {
    let IndexerModule;
    switch (options.chainSymbol) {
      case "Near":
        IndexerModule = NearIndexerModule;
        break;
      case "Stacks":
        IndexerModule = StacksIndexerModule;
        break;
      default:
        throw new Error(`Invalid CHAIN_SYMBOL: ${options.chainSymbol}`);
    }

    return {
      module: IndexersModule,
      imports: [
        ScrapersModule,
        CommonIndexerModule,
        IndexerModule,
        ConfigModule.forRoot(),
        TypeOrmModule.forFeature([ApiKey]),
      ],
      providers: [IndexerOrchestratorService],
      exports: [IndexerOrchestratorService],
      controllers: [IndexerController],
    };
  }
}
