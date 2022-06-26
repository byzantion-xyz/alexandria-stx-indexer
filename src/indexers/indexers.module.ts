import { Module } from '@nestjs/common';
import { NearIndexerController } from './near-indexer/near-indexer.controller';
import { IndexerOrchestratorService } from './indexer-orchestrator.service';
import { BuyTransactionService } from './common/providers/buy-transaction.service';
import { ListTransactionService } from './common/providers/list-transaction.service';
import { TxHelperService } from './near-indexer/providers/tx-helper.service';
import { UnlistTransactionService } from './common/providers/unlist-transaction.service';
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
    IndexerOrchestratorService,
    BuyTransactionService,
    ListTransactionService,
    TxHelperService,
    UnlistTransactionService,
    NearTxStreamAdapterService,
  ],
  exports: [
    IndexerOrchestratorService
  ]
})
export class IndexersModule {}
