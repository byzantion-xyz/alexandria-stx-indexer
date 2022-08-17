import { Injectable } from "@nestjs/common";
import { StakeIndexerService } from "src/indexers/near-indexer/providers/stake-indexer.service";
import { UnstakeIndexerService } from "src/indexers/near-indexer/providers/unstake-indexer.service";
import { IndexerService } from "../interfaces/indexer-service.interface";
import { BuyIndexerService } from "../../near-indexer/providers/buy-indexer.service";
import { ListIndexerService } from "../../near-indexer/providers/list-indexer.service";
import { UnlistIndexerService } from "../../near-indexer/providers/unlist-indexer.service";

@Injectable()
export class NearMicroIndexers {
  constructor(
    private buyIndexer: IndexerService,
    private listIndexer: IndexerService,
    private unlistIndexer: IndexerService,
    private stakeIndexer: IndexerService,
    private unstakeIndexer: IndexerService
  ) {} 
}

export const NearMicroIndexersProvider = {
  provide: 'NearMicroIndexers',
  useFactory: (
    buyIndexer: BuyIndexerService,
    listIndexer: ListIndexerService,
    unlistIndexer: UnlistIndexerService,
    stakeIndexer: StakeIndexerService,
    unstakeIndexer: UnstakeIndexerService
  ) => {
    return new NearMicroIndexers(buyIndexer, listIndexer, unlistIndexer, stakeIndexer, unstakeIndexer);
  },
  inject: [
    BuyIndexerService, 
    ListIndexerService, 
    UnlistIndexerService, 
    StakeIndexerService, 
    UnstakeIndexerService
  ],
};