import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonIndexerModule } from '../common/common-indexer.module';
import { NearTxHelperService } from './providers/near-tx-helper.service';
import { NearTxStreamAdapterService } from './providers/near-tx-stream-adapter.service';
import { FunctionCallEvent as NearFunctionCallEvent } from "src/database/near-stream/entities/FunctionCallEvent";
import { NearMicroIndexersProvider } from '../common/providers/near-micro-indexers.service';
import { BuyIndexerService } from './providers/buy-indexer.service';
import { ListIndexerService } from './providers/list-indexer.service';
import { UnlistIndexerService } from './providers/unlist-indexer.service';
import { StakeIndexerService } from './providers/stake-indexer.service';
import { UnstakeIndexerService } from './providers/unstake-indexer.service';
import { AcceptBidIndexerService } from './providers/accept-bid-indexer.service';
import { TransferIndexerService } from './providers/transfer-indexer.service';
import { BurnIndexerService } from './providers/burn-indexer.service';
import { ScrapersModule } from 'src/scrapers/scrapers.module';

@Module({
  imports: [
    ScrapersModule,
    CommonIndexerModule,
    TypeOrmModule.forFeature([NearFunctionCallEvent], "NEAR-STREAM"),
  ],
  providers: [
    NearTxHelperService,
    { provide: 'TxStreamAdapter',  useClass: NearTxStreamAdapterService },
    NearMicroIndexersProvider,
    /* Near Micro indexers */
    BuyIndexerService,
    ListIndexerService,
    UnlistIndexerService,
    StakeIndexerService,
    UnstakeIndexerService,
    AcceptBidIndexerService,
    TransferIndexerService,
    BurnIndexerService
  ],
  exports: [
    { provide: 'TxStreamAdapter', useClass: NearTxStreamAdapterService },
    NearTxHelperService,
    TypeOrmModule,
    NearMicroIndexersProvider
  ]
})
export class NearIndexerModule {}
