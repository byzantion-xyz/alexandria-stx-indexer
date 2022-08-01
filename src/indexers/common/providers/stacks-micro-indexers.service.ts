import { Injectable } from "@nestjs/common";
import { StakeIndexerService } from "src/indexers/common/providers/stake-indexer.service";
import { UnstakeIndexerService } from "src/indexers/common/providers/unstake-indexer.service";
import { BidIndexerService } from "src/indexers/stacks-indexer/providers/bid-indexer.service";
import { BnsAcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-accept-bid-indexer.service";
import { BnsBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-bid-indexer.service";
import { BnsRegisterIndexerService } from "src/indexers/stacks-indexer/providers/bns-register-indexer.service";
import { BnsUnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/bns-unlist-bid-indexer.service";
import { ChangePriceIndexerService } from "src/indexers/stacks-indexer/providers/change-price-indexer.service";
import { TransferIndexerService } from "src/indexers/stacks-indexer/providers/transfer-indexer.service";
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
    private stakeIndexer: IndexerService,
    private unstakeIndexer: IndexerService,
    private bnsRegisterIndexer: IndexerService,
    private bnsBidIndexer: IndexerService,
    private bnsUnlistBidIndexer: IndexerService,
    private bnsAcceptBidIndexer: IndexerService,
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
    stakeIndexer: StakeIndexerService,
    unstakeIndexer: UnstakeIndexerService,
    bnsRegisterIndexer: BnsRegisterIndexerService,
    bnsBidIndexer: BnsBidIndexerService,
    bnsUnlistBidIndexer: BnsUnlistBidIndexerService,
    bnsAcceptBidIndexer: BnsAcceptBidIndexerService,
    relistIndexer: ListIndexerService, // Alias for relist to list.
  ) => {
    return new StacksMicroIndexers(
      buyIndexer, 
      listIndexer, 
      unlistIndexer, 
      transferIndexer, 
      changePriceIndexer, 
      bidIndexer,
      stakeIndexer, 
      unstakeIndexer, 
      bnsRegisterIndexer, 
      bnsBidIndexer, 
      bnsUnlistBidIndexer,
      bnsAcceptBidIndexer,
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
    StakeIndexerService, 
    UnstakeIndexerService,
    BnsRegisterIndexerService,
    BnsUnlistBidIndexerService,
    BnsBidIndexerService,
    BnsAcceptBidIndexerService
  ]
};