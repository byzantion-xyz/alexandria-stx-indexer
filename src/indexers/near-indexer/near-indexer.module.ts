import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonIndexerModule } from '../common/common-indexer.module';
import { NearTxHelperService } from './providers/near-tx-helper.service';
import { NearTxStreamAdapterService } from './providers/near-tx-stream-adapter.service';
import { FunctionCallEvent as NearFunctionCallEvent } from "src/database/near-stream/entities/FunctionCallEvent";
import { NearMicroIndexersProvider } from '../common/providers/near-micro-indexers.service';


@Module({
  imports: [
    CommonIndexerModule,
    TypeOrmModule.forFeature([NearFunctionCallEvent], "NEAR-STREAM"),
  ],
  controllers: [],
  providers: [
    NearTxHelperService,
    { provide: 'TxStreamAdapter',  useClass: NearTxStreamAdapterService },
  ],
  exports: [
    { provide: 'TxStreamAdapter', useClass: NearTxStreamAdapterService },
    NearTxHelperService,
    TypeOrmModule
  ]
})
export class NearIndexerModule {}
