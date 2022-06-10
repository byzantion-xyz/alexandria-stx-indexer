import { Module } from '@nestjs/common';
import { NearIndexerController } from './near-indexer/near-indexer.controller';
import { NearIndexerService } from './near-indexer/near-indexer.service';
import { BuyTransactionService } from './near-indexer/providers/buy-transaction.service';
import { ListingTransactionService } from './near-indexer/providers/listing-transaction.service';
import { TxHelperService } from './near-indexer/providers/tx-helper.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UnlistTransactionService } from './near-indexer/providers/unlist-transaction.service';
import { DiscordBotModule } from 'src/discord-bot/discord-bot.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    MongooseModule.forFeature([], 'near-streamer'),
    DiscordBotModule,
    PrismaModule
  ],
  controllers: [NearIndexerController],
  providers: [
    NearIndexerService,
    BuyTransactionService,
    ListingTransactionService,
    TxHelperService,
    UnlistTransactionService,
  ]
})
export class IndexersModule {}
