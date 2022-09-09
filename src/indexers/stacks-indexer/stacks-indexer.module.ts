import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapersModule } from 'src/scrapers/scrapers.module';
import { CommonIndexerModule } from '../common/common-indexer.module';
import { Block } from "src/database/stacks-stream/entities/Block";
import { Transaction as StacksTransaction } from "src/database/stacks-stream/entities/Transaction";
import { StacksTxStreamAdapterService } from './providers/stacks-tx-stream-adapter.service';
import { StacksTxHelperService } from './providers/stacks-tx-helper.service';

@Module({
  imports: [
    ScrapersModule,
    CommonIndexerModule,
    TypeOrmModule.forFeature([StacksTransaction, Block], "STACKS-STREAM"),
  ],
  providers: [
    StacksTxHelperService,
    { provide: 'TxStreamAdapter',  useClass: StacksTxStreamAdapterService },
    //NearMicroIndexersProvider,
    /* Stacks micro indexers */
  ],
  exports: [
    { provide: 'TxStreamAdapter', useClass: StacksTxStreamAdapterService },
    StacksTxHelperService,
    TypeOrmModule,
    //NearMicroIndexersProvider
  ]
})
export class StacksIndexerModule {}
