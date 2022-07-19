import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { IndexerEventType } from 'src/indexers/common/helpers/indexer-enums';
import { IndexerOrchestratorService } from 'src/indexers/indexer-orchestrator.service';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private indexerOrchestrator: IndexerOrchestratorService
    ) {}

    /*@Cron(CronExpression.EVERY_30_MINUTES)
    handleCron() {
      if (process.env.NODE_ENV === 'production') {
        this.indexerOrchestrator.runIndexer({ includeMissings: false });
      } else {
        this.logger.debug('Not in production environment. Skip near indexer trigger')
      }
    }*/

    /*@Cron(CronExpression.EVERY_2_HOURS)
    handleCronMissingTransactions() {
      if (process.env.NODE_ENV === 'production') {
        this.indexerOrchestrator.runIndexer({ includeMissings: true });
      } else {
        this.logger.debug('Not in production environment. Skip near indexer trigger')
      }
    }*/

    @Timeout(2000)
    handleIndexerSubscription() {
      //this.indexerOrchestrator.subscribeToEvents({ event: IndexerEventType.block });
    }

}
