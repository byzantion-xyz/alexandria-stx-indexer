import { Injectable } from "@nestjs/common";
import { StakeIndexerService } from "src/indexers/near-indexer/providers/stake-indexer.service";
import { UnstakeIndexerService } from "src/indexers/near-indexer/providers/unstake-indexer.service";
import { IndexerService } from "../interfaces/indexer-service.interface";
import { BuyIndexerService } from "../../near-indexer/providers/buy-indexer.service";
import { ListIndexerService } from "../../near-indexer/providers/list-indexer.service";
import { UnlistIndexerService } from "../../near-indexer/providers/unlist-indexer.service";
import { AcceptBidIndexerService } from "src/indexers/near-indexer/providers/accept-bid-indexer.service";
import { TransferIndexerService } from "src/indexers/near-indexer/providers/transfer-indexer.service";
import { BurnIndexerService } from "src/indexers/near-indexer/providers/burn-indexer.service";

@Injectable()
export class MicroIndexers {
  constructor(
    private buyIndexer: IndexerService,
    private listIndexer: IndexerService,
    private unlistIndexer: IndexerService,
    private stakeIndexer: IndexerService,
    private unstakeIndexer: IndexerService,
    private acceptBidIndexer: IndexerService,
    private transferIndexer: IndexerService,
    private burnIndexer: IndexerService
  ) {}
}

export const NearMicroIndexersProvider = {
  provide: 'MicroIndexers',
  useFactory: (
    buyIndexer: BuyIndexerService,
    listIndexer: ListIndexerService,
    unlistIndexer: UnlistIndexerService,
    stakeIndexer: StakeIndexerService,
    unstakeIndexer: UnstakeIndexerService,
    acceptBidIndexer: AcceptBidIndexerService,
    transferIndexer: TransferIndexerService,
    burnIndexer: BurnIndexerService
  ) => {
    return new MicroIndexers(
      buyIndexer, 
      listIndexer, 
      unlistIndexer, 
      stakeIndexer, 
      unstakeIndexer, 
      acceptBidIndexer,
      transferIndexer,
      burnIndexer
    );
  },
  inject: [
    BuyIndexerService, 
    ListIndexerService, 
    UnlistIndexerService, 
    StakeIndexerService, 
    UnstakeIndexerService,
    AcceptBidIndexerService,
    TransferIndexerService,
    BurnIndexerService
  ],
};