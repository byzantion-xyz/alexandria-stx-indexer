import { Module } from '@nestjs/common';
import { NearIndexerController } from './near-indexer/near-indexer.controller';
import { NearIndexerService } from './near-indexer/near-indexer.service';
import { BuyTransactionService } from './near-indexer/providers/buy-transaction.service';
import { ListTransactionService } from './near-indexer/providers/list-transaction.service';
import { TxHelperService } from './near-indexer/providers/tx-helper.service';
import { UnlistTransactionService } from './near-indexer/providers/unlist-transaction.service';
import { DiscordBotModule } from 'src/discord-bot/discord-bot.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ScrapersModule } from 'src/scrapers/scrapers.module';
import { NearTxStreamAdapterService } from './near-indexer/providers/near-tx-stream-adapter.service';

@Module({
  imports: [
    DiscordBotModule,
    PrismaModule,
    ScrapersModule
  ],
  controllers: [NearIndexerController],
  providers: [
    NearIndexerService,
    BuyTransactionService,
    ListTransactionService,
    TxHelperService,
    UnlistTransactionService,
    NearTxStreamAdapterService,
  ],
  exports: [
    NearIndexerService
  ]
})
export class IndexersModule {}
