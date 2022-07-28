import { Injectable } from "@nestjs/common";
import { IndexerService } from "../interfaces/indexer-service.interface";

@Injectable()
export class Indexers {
  constructor(
    private buyIndexer: IndexerService,
    private listIndexer: IndexerService,
    private unlistIndexer: IndexerService,
    private relistIndexer?: IndexerService,
    private transferIndexer?: IndexerService,
    private stakeIndexer?: IndexerService,
    private unstakeIndexer?: IndexerService
  ) {} 
}

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
    private relistIndexer: IndexerService,
  ) {}
}