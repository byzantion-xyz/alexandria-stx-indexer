import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { IndexerEventType } from 'src/indexers/common/helpers/indexer-enums';
import { IndexerOptions } from 'src/indexers/common/interfaces/indexer-options';
import { IndexerOrchestratorService } from 'src/indexers/indexer-orchestrator.service';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
      private indexerOrchestrator: IndexerOrchestratorService
    ) {}

    @Timeout(10000)
    async handleCron() {
      if (process.env.NODE_ENV === 'production') {
        const initial_block = 72000000;
        const end_block = 80000000;
        const block_range = 100000;
        const options: IndexerOptions = { includeMissings: false };

        for (let b = initial_block; b < end_block; b = b + block_range) {
          options.start_block_height = b;
          options.end_block_height = b + block_range;
 
          await this.indexerOrchestrator.runIndexer(options);
        }
      } else {
        this.logger.debug('Not in production environment. Skip near indexer trigger')
      }
    }

    @Timeout(2000)
    handleIndexerSubscription() {
      this.indexerOrchestrator.subscribeToEvents({ event: IndexerEventType.block });
    }

}
