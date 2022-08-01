import { Injectable } from "@nestjs/common";
import { StakeIndexerService } from "src/indexers/common/providers/stake-indexer.service";
import { UnstakeIndexerService } from "src/indexers/common/providers/unstake-indexer.service";
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
    private stakeIndexer: IndexerService,
    private unstakeIndexer: IndexerService,
    private bnsRegisterIndexer: IndexerService,
    private bnsBidIndexer: IndexerService,
    private bnsUnlistBidIndexer: IndexerService,
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
    changePrice: ChangePriceIndexerService,
    stakeIndexer: StakeIndexerService,
    unstakeIndexer: UnstakeIndexerService,
    bnsRegisterIndexer: BnsRegisterIndexerService,
    bnsBidIndexer: BnsBidIndexerService,
    bnsUnlistBidIndexer: BnsUnlistBidIndexerService,
    relistIndexer: ListIndexerService, // Alias for relist to list.
  ) => {
    return new StacksMicroIndexers(
      buyIndexer, 
      listIndexer, 
      unlistIndexer, 
      transferIndexer, 
      changePrice, 
      stakeIndexer, 
      unstakeIndexer, 
      bnsRegisterIndexer, 
      bnsBidIndexer, 
      bnsUnlistBidIndexer, 
      relistIndexer
    );
  },
  inject: [
    BuyIndexerService, 
    ListIndexerService,
    UnlistIndexerService, 
    TransferIndexerService, 
    ChangePriceIndexerService,
    StakeIndexerService, 
    UnstakeIndexerService,
    BnsRegisterIndexerService,
    BnsUnlistBidIndexerService,
    BnsBidIndexerService
  ]
};