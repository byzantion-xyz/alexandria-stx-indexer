import { DynamicModule, Module } from "@nestjs/common";
import { IndexerController } from "./indexer.controller";
import { CommonIndexerModule } from "./common/common-indexer.module";
import { StacksIndexerModule } from "./stacks-indexer/stacks-indexer.module";
import { IndexerOrchestratorService } from "./indexer-orchestrator.service";
import { ConfigModule } from "@nestjs/config";
import { ApiKey } from "src/database/universal/entities/ApiKey";
import { TypeOrmModule } from "@nestjs/typeorm";

interface ChainOptions {
  chainSymbol: string;
}

const loadIndexerModule = (options: ChainOptions) => {
  switch (options.chainSymbol) {
    case "Stacks":
      return StacksIndexerModule;
    default:
      throw new Error(`Invalid CHAIN_SYMBOL: ${options.chainSymbol}`);
  }
};

@Module({})
export class IndexersModule {
  static register(options: ChainOptions): DynamicModule {
    const IndexerModule = loadIndexerModule(options);

    return {
      module: IndexersModule,
      imports: [CommonIndexerModule, IndexerModule, ConfigModule.forRoot(), TypeOrmModule.forFeature([ApiKey])],
      providers: [IndexerOrchestratorService],
      exports: [IndexerOrchestratorService],
      controllers: [IndexerController],
    };
  }
}
