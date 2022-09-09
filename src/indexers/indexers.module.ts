import { Module } from "@nestjs/common";
import { IndexerController } from "./indexer.controller";
import { IndexerOrchestratorService } from "./indexer-orchestrator.service";
import { ScrapersModule } from "src/scrapers/scrapers.module";
import { TypeOrmModule } from "@nestjs/typeorm";

import { StacksTxStreamAdapterService } from "./stacks-indexer/providers/stacks-tx-stream-adapter.service";
import { Block } from "src/database/stacks-stream/entities/Block";
import { Transaction as StacksTransaction } from "src/database/stacks-stream/entities/Transaction";
import { StacksTxHelperService } from "./stacks-indexer/providers/stacks-tx-helper.service";
import { TransferIndexerService as StacksTransferIndexerService } from './stacks-indexer/providers/transfer-indexer.service';

import { ChangePriceIndexerService } from './stacks-indexer/providers/change-price-indexer.service';
//import { BnsRegisterIndexerService } from './stacks-indexer/providers/bns-register-indexer.service';
import { StacksMicroIndexersProvider } from "./common/providers/stacks-micro-indexers.service";
//import { BnsBidIndexerService } from './stacks-indexer/providers/bns-bid-indexer.service';
//import { BnsUnlistBidIndexerService } from './stacks-indexer/providers/bns-unlist-bid-indexer.service';
//import { BnsAcceptBidIndexerService } from './stacks-indexer/providers/bns-accept-bid-indexer.service';
import { BidIndexerService } from './stacks-indexer/providers/bid-indexer.service';
import { UnlistBidIndexerService } from './stacks-indexer/providers/unlist-bid-indexer.service';
import { AcceptBidIndexerService as StacksAcceptBidIndexerService } from './stacks-indexer/providers/accept-bid-indexer.service';
import { CollectionOrderBookBidIndexerService } from './stacks-indexer/providers/collection-order-book-bid-indexer.service';
import { TxBidHelperService } from './common/helpers/tx-bid-helper.service';
import { CollectionOrderBookAcceptBidIndexerService } from './stacks-indexer/providers/collection-order-book-accept-bid-indexer.service';
import { CollectionRemoveOrderBookBidIndexerService } from './stacks-indexer/providers/collection-remove-order-book-bid-indexer.service';
import { CollectionMultiOrderBookBidIndexerService } from './stacks-indexer/providers/collection-multi-order-book-bid-indexer.service';
import { IdBidIndexerService } from './stacks-indexer/providers/id-bid-indexer.service';
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
import { UpgradeMegaIndexerService } from './stacks-indexer/providers/upgrade-mega-indexer.service';
import { ListIndexerService as StacksListIndexerService } from './stacks-indexer/providers/list-indexer.service';
import { UnlistIndexerService as StacksUnlistIndexerService } from './stacks-indexer/providers/unlist-indexer.service';
import { BuyIndexerService as StacksBuyIndexerService } from './stacks-indexer/providers/buy-indexer.service';
import { StakeIndexerService as StacksStakeIndexerService } from './stacks-indexer/providers/stake-indexer.service';
import { UnstakeIndexerService as StacksUnstakeIndexerService } from './stacks-indexer/providers/unstake-indexer.service';
import { BuyWrapperIndexerService } from './stacks-indexer/providers/buy-wrapper-indexer.service';
import { AdminSoloIdUnlistBidIndexerService } from './stacks-indexer/providers/admin-solo-id-unlist-bid-indexer.service';
import { NearIndexerModule } from './near-indexer/near-indexer.module';
import { CommonIndexerModule } from './common/common-indexer.module';

@Module({
  imports: [
    ScrapersModule,
    TypeOrmModule.forFeature([StacksTransaction, Block], "STACKS-STREAM"),
    CommonIndexerModule,
    NearIndexerModule,
  ],
  controllers: [IndexerController],
  providers: [
    IndexerOrchestratorService,
    /* Helpers */
  
    StacksTxHelperService,
   
    /* Stream adapters */
    StacksTxStreamAdapterService,
    
    /* Chain modules */
    NearIndexerModule,

    /* Micro indexers factory */
   
    StacksMicroIndexersProvider,

  
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
    StacksTransferIndexerService,
    ChangePriceIndexerService,
    BidIndexerService,
    UnlistBidIndexerService,
    StacksAcceptBidIndexerService,
    CollectionOrderBookBidIndexerService,
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
