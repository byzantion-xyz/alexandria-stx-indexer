import { Module } from "@nestjs/common";
import { NearIndexerController } from "./near-indexer/near-indexer.controller";
import { IndexerOrchestratorService } from "./indexer-orchestrator.service";
import { BuyIndexerService } from "./common/providers/buy-indexer.service";
import { ListIndexerService } from "./common/providers/list-indexer.service";
import { TxHelperService } from "./common/helpers/tx-helper.service";
import { UnlistIndexerService } from "./common/providers/unlist-indexer.service";
import { DiscordBotModule } from "src/discord-bot/discord-bot.module";
import { ScrapersModule } from "src/scrapers/scrapers.module";
import { NearTxStreamAdapterService } from "./near-indexer/providers/near-tx-stream-adapter.service";
import { NearTxHelperService } from "./near-indexer/providers/near-tx-helper.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Action } from "src/database/universal/entities/Action";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { NftState } from "src/database/universal/entities/NftState";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Transaction as NearTransaction } from "src/database/near-stream/entities/Transaction";
import { Receipt } from "src/database/near-stream/entities/Receipt";
import { StacksTxStreamAdapterService } from "./stacks-indexer/providers/stacks-tx-stream-adapter.service";
import { Chain } from "src/database/universal/entities/Chain";
import { Block } from "src/database/stacks-stream/entities/Block";
import { Transaction as StacksTransaction } from "src/database/stacks-stream/entities/Transaction";
import { StacksTxHelperService } from "./stacks-indexer/providers/stacks-tx-helper.service";
import { ConfigService } from "@nestjs/config";
import { TxStreamAdapter } from "./common/interfaces/tx-stream-adapter.interface";
import { TransferIndexerService } from './stacks-indexer/providers/transfer-indexer.service';
import { Commission } from "src/database/universal/entities/Commission";

/* Select stream adapter based on chain symbol env variable */
const TxStreamAdapterProvider = {
  provide: "TxStreamAdapter",
  useFactory: async (
    config: ConfigService,
    nearTxStreamAdapterService: NearTxStreamAdapterService,
    stacksTxStreamAdapterService: StacksTxStreamAdapterService
  ): Promise<TxStreamAdapter> => {
    switch (config.get("indexer.chainSymbol")) {
      case "Near": return nearTxStreamAdapterService;
      case "Stacks": return stacksTxStreamAdapterService;
      default:
        throw new Error(
          `Unable to find stream adapter for ${config.get("indexer.chainSymbol")}`
        );
    }
  },
  inject: [ConfigService, NearTxStreamAdapterService, StacksTxStreamAdapterService]
};

@Module({
  imports: [
    DiscordBotModule,
    ScrapersModule,
    TypeOrmModule.forFeature([
      NftMeta,
      NftState,
      Action,
      SmartContract,
      SmartContractFunction,
      Chain,
      Commission
    ]),
    TypeOrmModule.forFeature([NearTransaction, Receipt], "NEAR-STREAM"),
    TypeOrmModule.forFeature([StacksTransaction, Block], "STACKS-STREAM"),
  ],
  controllers: [NearIndexerController],
  providers: [
    IndexerOrchestratorService,
    /* Helpers */
    TxHelperService,
    NearTxHelperService,
    StacksTxHelperService,
    /* Stream adapters */
    NearTxStreamAdapterService,
    StacksTxStreamAdapterService,
    TxStreamAdapterProvider,
    /* Micro indexers */
    BuyIndexerService,
    ListIndexerService,
    UnlistIndexerService,
    TransferIndexerService  
  ],
  exports: [IndexerOrchestratorService],
})
export class IndexersModule {}
