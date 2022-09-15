import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonIndexerModule } from '../common/common-indexer.module';
import { NearTxHelperService } from './providers/near-tx-helper.service';
import { NearTxStreamAdapterService } from './providers/near-tx-stream-adapter.service';
import { FunctionCallEvent as NearFunctionCallEvent } from "src/database/near-stream/entities/FunctionCallEvent";
import { BuyIndexerService } from './providers/buy-indexer.service';
import { ListIndexerService } from './providers/list-indexer.service';
import { UnlistIndexerService } from './providers/unlist-indexer.service';
import { StakeIndexerService } from './providers/stake-indexer.service';
import { UnstakeIndexerService } from './providers/unstake-indexer.service';
import { AcceptBidIndexerService } from './providers/accept-bid-indexer.service';
import { TransferIndexerService } from './providers/transfer-indexer.service';
import { BurnIndexerService } from './providers/burn-indexer.service';
import { ScrapersModule } from 'src/scrapers/scrapers.module';
import { RelistIndexerService } from './providers/relist-indexer.service';
import { NftMintEventIndexerService } from './providers/nft-mint-event-indexer.service';

const microIndexers = [
  BuyIndexerService,
  ListIndexerService,
  UnlistIndexerService,
  StakeIndexerService,
  UnstakeIndexerService,
  AcceptBidIndexerService,
  TransferIndexerService,
  BurnIndexerService,
  RelistIndexerService,
  NftMintEventIndexerService
];

@Module({
  imports: [
    ScrapersModule,
    CommonIndexerModule,
    TypeOrmModule.forFeature([NearFunctionCallEvent], "CHAIN-STREAM"),
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
