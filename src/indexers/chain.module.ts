import { DynamicModule, Module } from '@nestjs/common';
import { ScrapersModule } from 'src/scrapers/scrapers.module';
import { CommonIndexerModule } from './common/common-indexer.module';

import { FunctionCallEvent as NearFunctionCallEvent } from "src/database/near-stream/entities/FunctionCallEvent";
import { NearMicroIndexersProvider } from './common/providers/near-micro-indexers.service';
import { NearTxHelperService } from './near-indexer/providers/near-tx-helper.service';
import { NearTxStreamAdapterService } from './near-indexer/providers/near-tx-stream-adapter.service';

import { BuyIndexerService } from './near-indexer/providers/buy-indexer.service';
import { ListIndexerService } from './near-indexer/providers/list-indexer.service';
import { UnlistIndexerService } from './near-indexer/providers/unlist-indexer.service';
import { StakeIndexerService } from './near-indexer/providers/stake-indexer.service';
import { UnstakeIndexerService } from './near-indexer/providers/unstake-indexer.service';
import { AcceptBidIndexerService } from './near-indexer/providers/accept-bid-indexer.service';
import { TransferIndexerService } from './near-indexer/providers/transfer-indexer.service';

import { BurnIndexerService } from './near-indexer/providers/burn-indexer.service';
import { StacksTxStreamAdapterService } from './stacks-indexer/providers/stacks-tx-stream-adapter.service';
import { Block } from "src/database/stacks-stream/entities/Block";
import { Transaction as StacksTransaction } from "src/database/stacks-stream/entities/Transaction";
import { StacksMicroIndexersProvider } from './common/providers/stacks-micro-indexers.service';
import { MissingCollectionService } from 'src/scrapers/near-scraper/providers/missing-collection.service';
import { NearIndexerModule } from './near-indexer/near-indexer.module';
import { StacksIndexerModule } from './stacks-indexer/stacks-indexer.module';

interface ChainOptions {
  chainSymbol: string;
}

@Module({})
export class ChainModule {
  static register(options: ChainOptions): DynamicModule {
    return {
      module: ChainModule,
      imports: [
        ScrapersModule,
        CommonIndexerModule,
        options.chainSymbol === 'Near' ? NearIndexerModule : StacksIndexerModule
      ],
      providers: [
        NearTxHelperService,
        { 
          provide: 'TxStreamAdapter',  
          useClass: options.chainSymbol === 'Near' ? NearTxStreamAdapterService : StacksTxStreamAdapterService 
        },
        options.chainSymbol === 'Near' ? NearMicroIndexersProvider : StacksMicroIndexersProvider
      ],
      exports: [
        { provide: 'TxStreamAdapter', useExisting: 'TxStreamAdapter' },
        NearTxHelperService,
        options.chainSymbol === 'Near' ? NearMicroIndexersProvider : StacksMicroIndexersProvider
      ]
    };
  }
}
