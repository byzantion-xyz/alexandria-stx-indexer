import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CommonIndexerModule } from "../common/common-indexer.module";
import { Block } from "src/database/stacks-stream/entities/Block";
import { Transaction as StacksTransaction } from "src/database/stacks-stream/entities/Transaction";
import { StacksTxStreamAdapterService } from "./providers/stacks-tx-stream-adapter.service";
import { StacksTxHelperService } from "./providers/stacks-tx-helper.service";

import { ListIndexerService } from "./providers/list-indexer.service";
import { UnlistIndexerService } from "./providers/unlist-indexer.service";
import { BuyIndexerService } from "./providers/buy-indexer.service";
import { BidIndexerService } from "./providers/bid-indexer.service";
import { UnlistBidIndexerService } from "./providers/unlist-bid-indexer.service";
import { AcceptBidIndexerService } from "./providers/accept-bid-indexer.service";
import { TxUpgradeHelperService } from "./helpers/tx-upgrade-helper.service";
import { NftTransferEventIndexerService } from "./providers/nft-transfer-event-indexer.service";
import { NftBurnEventIndexerService } from "./providers/nft-burn-event-indexer.service";
import { NftMintEventIndexerService } from "./providers/nft-mint-event-indexer.service";

const microIndexers = [
  ListIndexerService,
  UnlistIndexerService,
  BuyIndexerService,
  BidIndexerService,
  UnlistBidIndexerService,
  AcceptBidIndexerService,
  TxUpgradeHelperService,
  // NFT events
  NftTransferEventIndexerService,
  NftBurnEventIndexerService,
  NftMintEventIndexerService,
];

@Module({
  imports: [CommonIndexerModule, TypeOrmModule.forFeature([StacksTransaction, Block], "CHAIN-STREAM")],
  providers: [
    StacksTxHelperService,
    { provide: "TxStreamAdapter", useClass: StacksTxStreamAdapterService },
    ...microIndexers,
    {
      provide: "MicroIndexers",
      useFactory: (...microIndexers) => microIndexers,
      inject: [...microIndexers],
    },
  ],
  exports: [
    StacksTxHelperService,
    TypeOrmModule,
    { provide: "TxStreamAdapter", useClass: StacksTxStreamAdapterService },
    { provide: "MicroIndexers", useExisting: "MicroIndexers" },
  ],
})
export class StacksIndexerModule {}
