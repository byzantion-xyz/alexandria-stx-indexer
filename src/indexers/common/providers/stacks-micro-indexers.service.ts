import { Injectable } from "@nestjs/common";
import { AcceptBidIndexerService } from "src/indexers/stacks-indexer/providers/accept-bid-indexer.service";
import { BidIndexerService } from "src/indexers/stacks-indexer/providers/bid-indexer.service";
import { UnlistBidIndexerService } from "src/indexers/stacks-indexer/providers/unlist-bid-indexer.service";
import { IndexerService } from "../interfaces/indexer-service.interface";
import { BuyIndexerService } from "src/indexers/stacks-indexer/providers/buy-indexer.service";
import { ListIndexerService } from "src/indexers/stacks-indexer/providers/list-indexer.service";
import { UnlistIndexerService } from "src/indexers/stacks-indexer/providers/unlist-indexer.service";

// TODO: Try to simplify as a factory

@Injectable()
export class StacksMicroIndexers {
  constructor(
    private buyIndexer: IndexerService,
    private listIndexer: IndexerService,
    private unlistIndexer: IndexerService,
    private bidIndexer: IndexerService,
    private acceptBidIndexer: IndexerService,
    private unlistBidIndexer: IndexerService
  ) {}
}

export const StacksMicroIndexersProvider = {
  provide: "StacksMicroIndexers",
  useFactory: (
    buyIndexer: BuyIndexerService,
    listIndexer: ListIndexerService,
    unlistIndexer: UnlistIndexerService,
    bidIndexer: BidIndexerService,
    unlistBidIndexer: UnlistBidIndexerService,
    acceptBidIndexer: AcceptBidIndexerService
  ) => {
    return new StacksMicroIndexers(
      buyIndexer,
      listIndexer,
      unlistIndexer,
      bidIndexer,
      unlistBidIndexer,
      acceptBidIndexer
    );
  },
  inject: [
    BuyIndexerService,
    ListIndexerService,
    UnlistIndexerService,
    BidIndexerService,
    UnlistBidIndexerService,
    AcceptBidIndexerService,
  ],
};
