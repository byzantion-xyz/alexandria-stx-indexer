import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonIndexerModule } from '../common/common-indexer.module';
import { NearTxHelperService } from './providers/near-tx-helper.service';
import { NearTxStreamAdapterService } from './providers/near-tx-stream-adapter.service';
import { IndexerTxEvent as NearIndexerTxEvent } from "src/database/near-stream/entities/IndexerTxEvent";
import { BuyIndexerService } from './providers/buy-indexer.service';
import { ListIndexerService } from './providers/list-indexer.service';
import { UnlistIndexerService } from './providers/unlist-indexer.service';
import { StakeIndexerService } from './providers/stake-indexer.service';
import { UnstakeIndexerService } from './providers/unstake-indexer.service';
import { AcceptBidIndexerService } from './providers/accept-bid-indexer.service';
import { RelistIndexerService } from './providers/relist-indexer.service';
import { NftMintEventIndexerService } from './providers/nft-mint-event-indexer.service';
import { NftTransferEventIndexerService } from './providers/nft-transfer-event-indexer.service';
import { NftBurnEventIndexerService } from './providers/nft-burn-event-indexer.service';
import { BidIndexerService } from './providers/bid-indexer.service';
import { UnlistBidIndexerService } from './providers/unlist-bid-indexer.service';

const microIndexers = [
  BuyIndexerService,
  ListIndexerService,
  UnlistIndexerService,
  StakeIndexerService,
  UnstakeIndexerService,
  AcceptBidIndexerService,
  RelistIndexerService,
  NftMintEventIndexerService,
  NftTransferEventIndexerService,
  NftBurnEventIndexerService,
  BidIndexerService,
  UnlistBidIndexerService
];

@Module({
  imports: [
    CommonIndexerModule,
    TypeOrmModule.forFeature([NearIndexerTxEvent], "CHAIN-STREAM"),
  ],
  providers: [
    NearTxHelperService,
    { provide: 'TxStreamAdapter', useClass: NearTxStreamAdapterService },
    ...microIndexers,
    {
      provide: 'MicroIndexers',
      useFactory: (...microIndexers) => microIndexers,
      inject: [...microIndexers]
    }
  ],
  exports: [
    NearTxHelperService,
    TypeOrmModule,
    { provide: 'TxStreamAdapter', useClass: NearTxStreamAdapterService },
    { provide: 'MicroIndexers', useExisting: 'MicroIndexers'}
  ]
})
export class NearIndexerModule {}
