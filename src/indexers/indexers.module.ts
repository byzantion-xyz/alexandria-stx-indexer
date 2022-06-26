import { Module } from '@nestjs/common';
import { NearIndexerController } from './near-indexer/near-indexer.controller';
import { IndexerOrchestratorService } from './indexer-orchestrator.service';
import { BuyIndexerService } from './common/providers/buy-indexer.service';
import { ListIndexerService } from './common/providers/list-indexer.service';
import { TxHelperService } from './near-indexer/providers/tx-helper.service';
import { UnlistIndexerService } from './common/providers/unlist-indexer.service';
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
    BuyIndexerService,
    ListIndexerService,
    TxHelperService,
    UnlistIndexerService,
    NearTxStreamAdapterService,
  ],
  exports: [
    IndexerOrchestratorService
  ]
})
export class IndexersModule {}
