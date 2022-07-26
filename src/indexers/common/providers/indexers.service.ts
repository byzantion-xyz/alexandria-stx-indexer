import { Injectable } from "@nestjs/common";
import { IndexerService } from "../interfaces/indexer-service.interface";

@Injectable()
export class Indexers {
  constructor(
    private buyIndexer: IndexerService,
    private listIndexer: IndexerService,
    private unlistIndexer: IndexerService,
    private transferIndexer?: IndexerService,
    private stakeIndexer?: IndexerService
  ) {} 
}