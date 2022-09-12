import { Injectable } from "@nestjs/common";
import { StakeIndexerService } from "src/indexers/stacks-indexer/providers/stake-indexer.service";
import { UnstakeIndexerService } from "src/indexers/stacks-indexer/providers/unstake-indexer.service";
import { AcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/accept-bid-indexer.service";
import { BidIndexerService } from "src/indexers/stacks-indexer/providers/bid-indexer.service";
//import { BnsAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-accept-bid-indexer.service";
//import { BnsBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-bid-indexer.service";
//import { BnsRegisterIndexerService } from "src/indexers/stacks-indexer/providers/bns-register-indexer.service";
//import { BnsUnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-unlist-bid-indexer.service";
import { ChangePriceIndexerService } from "src/indexers/stacks-indexer/providers/change-price-indexer.service";
import { CollectionAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-accept-bid-indexer.service";
import { CollectionBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-bid-indexer.service";
import { CollectionMultiOrderBookBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-multi-order-book-bid-indexer.service";
import { CollectionOrderBookAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-order-book-accept-bid-indexer.service";
import { CollectionOrderBookBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-order-book-bid-indexer.service";
import { CollectionRemoveOrderBookBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-remove-order-book-bid-indexer.service";
import { CollectionUnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-unlist-bid-indexer.service";
import { IdAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/id-accept-bid-indexer.service";
import { IdBidIndexerService } from "src/indexers/stacks-indexer/providers/id-bid-indexer.service";
import { IdRemoveBidIndexerService } from "src/indexers/stacks-indexer/providers/id-remove-bid-indexer.service";
import { UpgradeMegaIndexerService } from "src/indexers/stacks-indexer/providers/upgrade-mega-indexer.service";
import { MultiIdBidIndexerService } from "src/indexers/stacks-indexer/providers/multi-id-bid-indexer.service";
import { RelistIndexerService } from "src/indexers/stacks-indexer/providers/relist-indexer.service";
import { RenameIndexerService } from "src/indexers/stacks-indexer/providers/rename-indexer.service";
import { SoloIdAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/solo-id-accept-bid-indexer.service";
import { SoloIdBidIndexerService } from "src/indexers/stacks-indexer/providers/solo-id-bid-indexer.service";
import { SoloIdUnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/solo-id-unlist-bid-indexer.service";
import { TransferIndexerService } from "src/indexers/stacks-indexer/providers/transfer-indexer.service";
import { UnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/unlist-bid-indexer.service";
import { UpgradeIndexerService } from "src/indexers/stacks-indexer/providers/upgrade-indexer.service";
import { IndexerService } from "../interfaces/indexer-service.interface";
import { BuyIndexerService } from "src/indexers/stacks-indexer/providers/buy-indexer.service";
import { ListIndexerService } from "src/indexers/stacks-indexer/providers/list-indexer.service";
import { UnlistIndexerService } from "src/indexers/stacks-indexer/providers/unlist-indexer.service";
import { BuyWrapperIndexerService } from "src/indexers/stacks-indexer/providers/buy-wrapper-indexer.service";
import { AdminSoloIdUnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/admin-solo-id-unlist-bid-indexer.service";

// TODO: Try to simplify as a factory

@Injectable()
export class MicroIndexers {
  constructor(
    private buyIndexer: IndexerService,
    private listIndexer: IndexerService,
    private unlistIndexer: IndexerService,
    private relistIndexer: IndexerService,
    private transferIndexer: IndexerService,
    private changePriceIndexer: IndexerService,
    private bidIndexer: IndexerService,
    private unlistBidIndexer: IndexerService,
    private acceptBidIndexer: IndexerService,
    private stakeIndexer: IndexerService,
    private unstakeIndexer: IndexerService,
    //private bnsRegisterIndexer: IndexerService,
    //private bnsBidIndexer: IndexerService,
    //private bnsUnlistBidIndexer: IndexerService,
    //private bnsAcceptBidIndexer: IndexerService,
    private collectionBidIndexer: IndexerService,
    private collectionUnlistBidIndexer: IndexerService,
    private collectionAcceptBidIndexer: IndexerService,
    private collectionOrderBookBidIndexer: IndexerService,
    private collectionOrderBookAcceptBidIndexer: IndexerService,
    private collectionRemoveOrderBookBidIndexer: IndexerService,
    private collectionMultiOrderBookBidIndexer: IndexerService,
    private idBidIndexer: IndexerService,
    private multiIdBidIndexer: IndexerService,
    private idAcceptBidIndexer: IndexerService,
    private idRemoveBidIndexer: IndexerService,
    private soloIdBidIndexer: IndexerService,
    private soloIdUnlistBidIndexer: IndexerService,
    private soloIdAcceptBidIndexer: IndexerService,
    private adminSoloIdUnlistBidIndexer: IndexerService,
    private renameIndexer: IndexerService,
    private upgradeIndexer: IndexerService,
    private upgradeMegaIndexer: IndexerService,
    private buyWrapperIndexer: IndexerService
  ) {}
}

export const StacksMicroIndexersProvider = {
  provide: 'MicroIndexers',
  useFactory: (
    buyIndexer: BuyIndexerService,
    listIndexer: ListIndexerService,
    unlistIndexer: UnlistIndexerService,
    relistIndexer: RelistIndexerService, // Alias for relist to list.
    transferIndexer: TransferIndexerService,
    changePriceIndexer: ChangePriceIndexerService,
    bidIndexer: BidIndexerService,
    unlistBidIndexer: UnlistBidIndexerService,
    acceptBidIndexer: AcceptBidIndexerService,
    stakeIndexer: StakeIndexerService,
    unstakeIndexer: UnstakeIndexerService,
    //bnsRegisterIndexer: BnsRegisterIndexerService,
    //bnsBidIndexer: BnsBidIndexerService,
    //bnsUnlistBidIndexer: BnsUnlistBidIndexerService,
    //bnsAcceptBidIndexer: BnsAcceptBidIndexerService,
    collectionBidIndexer: CollectionBidIndexerService,
    collectionUnlistBidIndexer: CollectionUnlistBidIndexerService,
    collectionAcceptBidIndexer: CollectionAcceptBidIndexerService,
    collectionOrderBookBidIndexer: CollectionOrderBookBidIndexerService,
    collectionOrderBookAcceptBidIndexer: CollectionOrderBookAcceptBidIndexerService,
    collectionRemoveOrderBookBidIndexer: CollectionRemoveOrderBookBidIndexerService,
    collectionMultiOrderBookBidIndexer: CollectionMultiOrderBookBidIndexerService,
    idBidIndexer: IdBidIndexerService,
    multiIdBidIndexer: MultiIdBidIndexerService,
    idAcceptBidIndexer: IdAcceptBidIndexerService,
    idRemoveBidIndexer: IdRemoveBidIndexerService,
    soloIdBidIndexer: SoloIdBidIndexerService,
    soloIdUnlistBidIndexer: SoloIdUnlistBidIndexerService,
    soloIdAcceptBidIndexer: SoloIdAcceptBidIndexerService,
    adminSoloIdUnlistBidIndexer: AdminSoloIdUnlistBidIndexerService,
    renameIndexer: RenameIndexerService,
    upgradeIndexer: UpgradeIndexerService,
    upgradeMegaIndexer: UpgradeMegaIndexerService,
    buyWrapperIndexer: BuyWrapperIndexerService
  ) => {
    return new MicroIndexers(
      buyIndexer, 
      listIndexer,
      unlistIndexer, 
      relistIndexer,
      transferIndexer,
      changePriceIndexer, 
      bidIndexer,
      unlistBidIndexer,
      acceptBidIndexer,
      stakeIndexer, 
      unstakeIndexer, 
      //bnsRegisterIndexer, 
      //bnsBidIndexer, 
      //bnsUnlistBidIndexer,
      //bnsAcceptBidIndexer,
      collectionBidIndexer, 
      collectionUnlistBidIndexer,
      collectionAcceptBidIndexer,
      collectionOrderBookBidIndexer,
      collectionOrderBookAcceptBidIndexer,
      collectionRemoveOrderBookBidIndexer,
      collectionMultiOrderBookBidIndexer,
      idBidIndexer,
      multiIdBidIndexer,
      idAcceptBidIndexer,
      idRemoveBidIndexer,
      soloIdBidIndexer,
      soloIdUnlistBidIndexer,
      soloIdAcceptBidIndexer,
      adminSoloIdUnlistBidIndexer,
      renameIndexer,
      upgradeIndexer, 
      upgradeMegaIndexer,
      buyWrapperIndexer
    );
  },
  inject: [
    BuyIndexerService, 
    ListIndexerService,
    UnlistIndexerService,
    RelistIndexerService, 
    TransferIndexerService, 
    ChangePriceIndexerService,
    BidIndexerService,
    UnlistBidIndexerService,
    AcceptBidIndexerService,
    StakeIndexerService, 
    UnstakeIndexerService,
    //BnsRegisterIndexerService,
    //BnsUnlistBidIndexerService,
    //BnsBidIndexerService,
    //BnsAcceptBidIndexerService,
    CollectionBidIndexerService,
    CollectionUnlistBidIndexerService,
    CollectionAcceptBidIndexerService,
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
    AdminSoloIdUnlistBidIndexerService,
    RenameIndexerService,
    UpgradeIndexerService,
    UpgradeMegaIndexerService,
    BuyWrapperIndexerService
  ]
};