import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { NearIndexerController } from './near-indexer/near-indexer.controller';
import { NearIndexerService } from './near-indexer/near-indexer.service';
import { BuyTransactionService } from './near-indexer/buy-transaction/buy-transaction.service';
import { ListingTransactionService } from './near-indexer/listing-transaction/listing-transaction.service';
import { TxHelperService } from './near-indexer/helpers/tx-helper/tx-helper.service';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([], 'near-streamer')
  ],
  controllers: [NearIndexerController],
  providers: [
    NearIndexerService,
    PrismaService,
    BuyTransactionService,
    ListingTransactionService,
    TxHelperService,
  ]
})
export class IndexersModule {}
