import { Injectable } from "@nestjs/common";
import { StakeIndexerService } from "src/indexers/common/providers/stake-indexer.service";
import { UnstakeIndexerService } from "src/indexers/common/providers/unstake-indexer.service";
import { AcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/accept-bid-indexer.service";
import { BidIndexerService } from "src/indexers/stacks-indexer/providers/bid-indexer.service";
import { BnsAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-accept-bid-indexer.service";
import { BnsBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-bid-indexer.service";
import { BnsRegisterIndexerService } from "src/indexers/stacks-indexer/providers/bns-register-indexer.service";
import { BnsUnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-unlist-bid-indexer.service";
import { ChangePriceIndexerService } from "src/indexers/stacks-indexer/providers/change-price-indexer.service";
import { CollectionMultiOrderBookBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-multi-order-book-bid-indexer.service";
import { CollectionOrderBookAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-order-book-accept-bid-indexer.service";
import { CollectionOrderBookBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-order-book-bid-indexer.service";
import { CollectionRemoveOrderBookBidIndexerService } from "src/indexers/stacks-indexer/providers/collection-remove-order-book-bid-indexer.service";
import { IdAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/id-accept-bid-indexer.service";
import { IdBidIndexerService } from "src/indexers/stacks-indexer/providers/id-bid-indexer.service";
import { MultiIdBidIndexerService } from "src/indexers/stacks-indexer/providers/multi-id-bid-indexer.service";
import { TransferIndexerService } from "src/indexers/stacks-indexer/providers/transfer-indexer.service";
import { UnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/unlist-bid-indexer.service";
import { IndexerService } from "../interfaces/indexer-service.interface";
import { BuyIndexerService } from "./buy-indexer.service";
import { ListIndexerService } from "./list-indexer.service";
import { UnlistIndexerService } from "./unlist-indexer.service";

@Injectable()
export class StacksMicroIndexers {
  constructor(
    private buyIndexer: IndexerService,
    private listIndexer: IndexerService,
    private unlistIndexer: IndexerService,
    private transferIndexer: IndexerService,
    private changePriceIndexer: IndexerService,
    private bidIndexer: IndexerService,
    private acceptBidIndexer: IndexerService,
    private unlistBidIndexer: IndexerService,
    private stakeIndexer: IndexerService,
    private unstakeIndexer: IndexerService,
    private bnsRegisterIndexer: IndexerService,
    private bnsBidIndexer: IndexerService,
    private bnsUnlistBidIndexer: IndexerService,
    private bnsAcceptBidIndexer: IndexerService,
    private collectionAcceptOrderBookBidIndexer: IndexerService,
    private collectionOrderBookBidIndexer: IndexerService,
    private collectionRemoveOrderBookBidIndexer: IndexerService,
    private collectionMultiOrderBookBidIndexer: IndexerService,
    private idBidIndexer: IndexerService,
    private multIdBidIndexer: IndexerService,
    private idAcceptBidIndexer: IndexerService,
    private relistIndexer: IndexerService,
  ) {}
}

export const StacksMicroIndexersProvider = {
  provide: 'StacksMicroIndexers',
  useFactory: (
    buyIndexer: BuyIndexerService,
    listIndexer: ListIndexerService,
    unlistIndexer: UnlistIndexerService,
    transferIndexer: TransferIndexerService,
    changePriceIndexer: ChangePriceIndexerService,
    bidIndexer: BidIndexerService,
    unlistBidIndexer: UnlistBidIndexerService,
    acceptBidIndexer: AcceptBidIndexerService,
    stakeIndexer: StakeIndexerService,
    unstakeIndexer: UnstakeIndexerService,
    bnsRegisterIndexer: BnsRegisterIndexerService,
    bnsBidIndexer: BnsBidIndexerService,
    bnsUnlistBidIndexer: BnsUnlistBidIndexerService,
    bnsAcceptBidIndexer: BnsAcceptBidIndexerService,
    collectionOrderBookBidIndexer: CollectionOrderBookBidIndexerService,
    collectionAcceptOrderBookBidIndexer: CollectionOrderBookAcceptBidIndexerService,
    collectionRemoveOrderBookBidIndexer: CollectionRemoveOrderBookBidIndexerService,
    collectionMultiOrderBookBidIndexer: CollectionMultiOrderBookBidIndexerService,
    idBidIndexer: IdBidIndexerService,
    multiIdBidIndexer: MultiIdBidIndexerService,
    idAcceptBidIndexer: IdAcceptBidIndexerService,
    relistIndexer: ListIndexerService, // Alias for relist to list.
  ) => {
    return new StacksMicroIndexers(
      buyIndexer, 
      listIndexer,
      unlistIndexer, 
      transferIndexer,
      changePriceIndexer, 
      bidIndexer,
      unlistBidIndexer,
      acceptBidIndexer,
      stakeIndexer, 
      unstakeIndexer, 
      bnsRegisterIndexer, 
      bnsBidIndexer, 
      bnsUnlistBidIndexer,
      bnsAcceptBidIndexer,
      collectionAcceptOrderBookBidIndexer,
      collectionOrderBookBidIndexer,
      collectionRemoveOrderBookBidIndexer,
      collectionMultiOrderBookBidIndexer,
      idBidIndexer,
      multiIdBidIndexer,
      idAcceptBidIndexer,
      relistIndexer
    );
  },
  inject: [
    BuyIndexerService, 
    ListIndexerService,
    UnlistIndexerService, 
    TransferIndexerService, 
    ChangePriceIndexerService,
    BidIndexerService,
    UnlistBidIndexerService,
    AcceptBidIndexerService,
    StakeIndexerService, 
    UnstakeIndexerService,
    BnsRegisterIndexerService,
    BnsUnlistBidIndexerService,
    BnsBidIndexerService,
    BnsAcceptBidIndexerService,
    CollectionOrderBookBidIndexerService,
    CollectionOrderBookAcceptBidIndexerService,
    CollectionRemoveOrderBookBidIndexerService,
    CollectionMultiOrderBookBidIndexerService,
    IdBidIndexerService,
    MultiIdBidIndexerService,
    IdAcceptBidIndexerService
  ]
};