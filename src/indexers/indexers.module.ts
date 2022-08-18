import { Injectable, Module } from "@nestjs/common";
import { IndexerController } from "./indexer.controller";
import { IndexerOrchestratorService } from "./indexer-orchestrator.service";
import { BuyIndexerService } from "./near-indexer/providers/buy-indexer.service";
import { ListIndexerService } from "./near-indexer/providers/list-indexer.service";
import { TxHelperService } from "./common/helpers/tx-helper.service";
import { UnlistIndexerService } from "./near-indexer/providers/unlist-indexer.service";
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

import { StakeIndexerService } from "./near-indexer/providers/stake-indexer.service";
import { TxStakingHelperService } from './common/helpers/tx-staking-helper.service';
import { UnstakeIndexerService } from './near-indexer/providers/unstake-indexer.service';
import { ChangePriceIndexerService } from './stacks-indexer/providers/change-price-indexer.service';
//import { BnsRegisterIndexerService } from './stacks-indexer/providers/bns-register-indexer.service';
import { NearMicroIndexersProvider } from "./common/providers/near-micro-indexers.service";
import { StacksMicroIndexersProvider } from "./common/providers/stacks-micro-indexers.service";
import { Collection } from "src/database/universal/entities/Collection";
//import { BnsBidIndexerService } from './stacks-indexer/providers/bns-bid-indexer.service';
//import { BnsUnlistBidIndexerService } from './stacks-indexer/providers/bns-unlist-bid-indexer.service';
//import { BnsAcceptBidIndexerService } from './stacks-indexer/providers/bns-accept-bid-indexer.service';
import { BidIndexerService } from './stacks-indexer/providers/bid-indexer.service';
import { UnlistBidIndexerService } from './stacks-indexer/providers/unlist-bid-indexer.service';
import { AcceptBidIndexerService } from './stacks-indexer/providers/accept-bid-indexer.service';
import { BidState } from "src/database/universal/entities/BidState";
import { CollectionOrderBookBidIndexerService } from './stacks-indexer/providers/collection-order-book-bid-indexer.service';
import { TxBidHelperService } from './common/helpers/tx-bid-helper.service';
import { CollectionOrderBookAcceptBidIndexerService } from './stacks-indexer/providers/collection-order-book-accept-bid-indexer.service';
import { CollectionRemoveOrderBookBidIndexerService } from './stacks-indexer/providers/collection-remove-order-book-bid-indexer.service';
import { CollectionMultiOrderBookBidIndexerService } from './stacks-indexer/providers/collection-multi-order-book-bid-indexer.service';
import { IdBidIndexerService } from './stacks-indexer/providers/id-bid-indexer.service';
import { CollectionAttribute } from "src/database/universal/entities/CollectionAttribute";
import { MultiIdBidIndexerService } from './stacks-indexer/providers/multi-id-bid-indexer.service';
import { IdAcceptBidIndexerService } from './stacks-indexer/providers/id-accept-bid-indexer.service';
import { IdRemoveBidIndexerService } from './stacks-indexer/providers/id-remove-bid-indexer.service';
import { SoloIdBidIndexerService } from './stacks-indexer/providers/solo-id-bid-indexer.service';
import { SoloIdUnlistBidIndexerService } from './stacks-indexer/providers/solo-id-unlist-bid-indexer.service';
import { SoloIdAcceptBidIndexerService } from './stacks-indexer/providers/solo-id-accept-bid-indexer.service';
import { CollectionBidIndexerService } from './stacks-indexer/providers/collection-bid-indexer.service';
import { CollectionUnlistBidIndexerService } from './stacks-indexer/providers/collection-unlist-bid-indexer.service';
import { CollectionAcceptBidIndexerService } from './stacks-indexer/providers/collection-accept-bid-indexer.service';
import { RelistIndexerService } from './stacks-indexer/providers/relist-indexer.service';
import { RenameIndexerService } from './stacks-indexer/providers/rename-indexer.service';
import { UpgradeIndexerService } from './stacks-indexer/providers/upgrade-indexer.service';
import { TxUpgradeHelperService } from './stacks-indexer/helpers/tx-upgrade-helper.service';
import { NftMetaAttribute } from "src/database/universal/entities/NftMetaAttribute";
import { UpgradeMegaIndexerService } from './stacks-indexer/providers/upgrade-mega-indexer.service';
import { MegapontAttribute } from "src/database/universal/entities/MegapontAttribute";
import { ListIndexerService as StacksListIndexerService } from './stacks-indexer/providers/list-indexer.service';
import { UnlistIndexerService as StacksUnlistIndexerService } from './stacks-indexer/providers/unlist-indexer.service';
import { BuyIndexerService as StacksBuyIndexerService } from './stacks-indexer/providers/buy-indexer.service';
import { StakeIndexerService as StacksStakeIndexerService } from './stacks-indexer/providers/stake-indexer.service';
import { UnstakeIndexerService as StacksUnstakeIndexerService } from './stacks-indexer/providers/unstake-indexer.service';
import { BuyWrapperIndexerService } from './stacks-indexer/providers/buy-wrapper-indexer.service';
import { NftStateList } from "src/database/universal/entities/NftStateList";
import { AdminSoloIdUnlistBidIndexerService } from './stacks-indexer/providers/admin-solo-id-unlist-bid-indexer.service';

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
      CollectionAttribute,
      Chain,
      Commission,
      Collection,
      BidState,
      NftMetaAttribute,
      MegapontAttribute,
      NftStateList
    ]),
    TypeOrmModule.forFeature([NearTransaction, Receipt], "NEAR-STREAM"),
    TypeOrmModule.forFeature([StacksTransaction, Block], "STACKS-STREAM"),
  ],
  controllers: [IndexerController],
  providers: [
    IndexerOrchestratorService,
    /* Helpers */
    TxHelperService,
    NearTxHelperService,
    StacksTxHelperService,
    TxStakingHelperService,
    /* Stream adapters */
    NearTxStreamAdapterService,
    StacksTxStreamAdapterService,
    TxStreamAdapterProvider,
    /* Micro indexers factory */
    NearMicroIndexersProvider,
    StacksMicroIndexersProvider,
    /* Near Micro indexers */
    BuyIndexerService,
    ListIndexerService,
    UnlistIndexerService,
    StakeIndexerService,
    UnstakeIndexerService,
    /* Stacks micro indexers */
    //BnsRegisterIndexerService,
    //BnsBidIndexerService,
    //BnsUnlistBidIndexerService,
    //BnsAcceptBidIndexerService,
    StacksListIndexerService,
    StacksUnlistIndexerService,
    StacksBuyIndexerService,
    StacksStakeIndexerService,
    StacksUnstakeIndexerService,
    TransferIndexerService,
    ChangePriceIndexerService,
    BidIndexerService,
    UnlistBidIndexerService,
    AcceptBidIndexerService,
    CollectionOrderBookBidIndexerService,
    TxBidHelperService,
    CollectionOrderBookAcceptBidIndexerService,
    CollectionRemoveOrderBookBidIndexerService,
    CollectionMultiOrderBookBidIndexerService,
    IdBidIndexerService,
    MultiIdBidIndexerService,
    IdAcceptBidIndexerService,
    IdRemoveBidIndexerService,
    SoloIdBidIndexerService,
    SoloIdUnlistBidIndexerService,
    SoloIdAcceptBidIndexerService,
    CollectionBidIndexerService,
    CollectionUnlistBidIndexerService,
    CollectionAcceptBidIndexerService,
    RelistIndexerService,
    RenameIndexerService,
    UpgradeIndexerService,
    TxUpgradeHelperService,
    UpgradeMegaIndexerService,
    BuyWrapperIndexerService,
    AdminSoloIdUnlistBidIndexerService
  ],
  exports: [IndexerOrchestratorService],
})
export class IndexersModule {}
