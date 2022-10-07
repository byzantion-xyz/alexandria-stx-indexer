import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { IndexerOptions } from 'src/indexers/common/interfaces/indexer-options';
import { IndexerOrchestratorService } from 'src/indexers/indexer-orchestrator.service';
import { NearOwnershipService } from 'src/ownership/providers/near-ownership.service';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
      private indexerOrchestrator: IndexerOrchestratorService,
      private configService: ConfigService,
      private nearOwnershipService: NearOwnershipService
    ) {}

    @Timeout(10000)
    async handleCron() {
      const runPendingTransactions = this.configService.get('indexer.runPendingTransactions');
      if (runPendingTransactions) {
        const blockConfig = this.configService.get('indexer.blockRanges')[this.configService.get('indexer.chainSymbol')];
        const initial_block = blockConfig.start_block_height_tip;
        const end_block = blockConfig.end_block_height;
        const block_range = blockConfig.block_range;
        const options: IndexerOptions = { includeMissings: false };

        for (let b = initial_block; b < end_block; b = b + block_range) {
          options.start_block_height = b;
          options.end_block_height = b + block_range;
 
          await this.indexerOrchestrator.runIndexer(options);
        }
      }
    }

    @Timeout(2000)
    handleIndexerSubscription() {
      const streamerSubscription = this.configService.get('indexer.enableStreamerSubscription');
      if (streamerSubscription) {
        this.indexerOrchestrator.subscribeToEvents();
      }
    }

    @Timeout(1000)
    checkOwnership() {
      this.logger.log('checkOwnership()');
      this.nearOwnershipService.process();
    }
}
