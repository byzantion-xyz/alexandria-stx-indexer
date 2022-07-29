import { Injectable } from "@nestjs/common";
import { StakeIndexerService } from "src/indexers/common/providers/stake-indexer.service";
import { UnstakeIndexerService } from "src/indexers/common/providers/unstake-indexer.service";
import { IndexerService } from "../interfaces/indexer-service.interface";
import { BuyIndexerService } from "./buy-indexer.service";
import { ListIndexerService } from "./list-indexer.service";
import { UnlistIndexerService } from "./unlist-indexer.service";

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