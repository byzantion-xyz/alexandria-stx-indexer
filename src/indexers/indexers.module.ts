import { Injectable, Module } from "@nestjs/common";
import { IndexerController } from "./indexer.controller";
import { IndexerOrchestratorService } from "./indexer-orchestrator.service";
import { TxHelperService } from "./common/helpers/tx-helper.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Action } from "src/database/universal/entities/Action";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { NftState } from "src/database/universal/entities/NftState";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { StacksTxStreamAdapterService } from "./stacks-indexer/providers/stacks-tx-stream-adapter.service";
import { Chain } from "src/database/universal/entities/Chain";
import { Block } from "src/database/stacks-stream/entities/Block";
import { Transaction as StacksTransaction } from "src/database/stacks-stream/entities/Transaction";
import { StacksTxHelperService } from "./stacks-indexer/providers/stacks-tx-helper.service";
import { ConfigService } from "@nestjs/config";
import { TxStreamAdapter } from "./common/interfaces/tx-stream-adapter.interface";
import { Commission } from "src/database/universal/entities/Commission";

import { TxStakingHelperService } from "./common/helpers/tx-staking-helper.service";
import { StacksMicroIndexersProvider } from "./common/providers/stacks-micro-indexers.service";
import { Collection } from "src/database/universal/entities/Collection";
import { BidIndexerService } from "./stacks-indexer/providers/bid-indexer.service";
import { UnlistBidIndexerService } from "./stacks-indexer/providers/unlist-bid-indexer.service";
import { AcceptBidIndexerService } from "./stacks-indexer/providers/accept-bid-indexer.service";
import { BidState } from "src/database/universal/entities/BidState";
import { TxBidHelperService } from "./common/helpers/tx-bid-helper.service";
import { CollectionAttribute } from "src/database/universal/entities/CollectionAttribute";
import { TxUpgradeHelperService } from "./stacks-indexer/helpers/tx-upgrade-helper.service";
import { NftMetaAttribute } from "src/database/universal/entities/NftMetaAttribute";
import { ListIndexerService as StacksListIndexerService } from "./stacks-indexer/providers/list-indexer.service";
import { UnlistIndexerService as StacksUnlistIndexerService } from "./stacks-indexer/providers/unlist-indexer.service";
import { BuyIndexerService as StacksBuyIndexerService } from "./stacks-indexer/providers/buy-indexer.service";
import { NftStateList } from "src/database/universal/entities/NftStateList";

/* Select stream adapter based on chain symbol env variable */
const TxStreamAdapterProvider = {
  provide: "TxStreamAdapter",
  useFactory: async (
    config: ConfigService,
    stacksTxStreamAdapterService: StacksTxStreamAdapterService
  ): Promise<TxStreamAdapter> => {
    switch (config.get("indexer.chainSymbol")) {
      case "Stacks":
        return stacksTxStreamAdapterService;
      default:
        throw new Error(`Unable to find stream adapter for ${config.get("indexer.chainSymbol")}`);
    }
  },
  inject: [ConfigService, StacksTxStreamAdapterService],
};

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NftMeta,
      NftState,
      Action,
      SmartContract,
      SmartContractFunction,
      CollectionAttribute,
      Chain,
      Commission,
      Collection,
      BidState,
      NftMetaAttribute,
      NftStateList,
    ]),
    // Connect only configured chain stream DB
    TypeOrmModule.forFeature([StacksTransaction, Block], "STACKS-STREAM"),
  ],
  controllers: [IndexerController],
  providers: [
    IndexerOrchestratorService,
    /* Helpers */
    TxHelperService,
    StacksTxHelperService,
    TxStakingHelperService,
    /* Stream adapters */
    StacksTxStreamAdapterService,
    TxStreamAdapterProvider,
    /* Micro indexers factory */
    StacksMicroIndexersProvider,
    /* Stacks micro indexers */
    StacksListIndexerService,
    StacksUnlistIndexerService,
    StacksBuyIndexerService,
    BidIndexerService,
    UnlistBidIndexerService,
    AcceptBidIndexerService,
    TxBidHelperService,
    TxUpgradeHelperService,
  ],
  exports: [IndexerOrchestratorService],
})
export class IndexersModule {}
