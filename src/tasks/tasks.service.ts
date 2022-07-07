import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IndexerOrchestratorService } from 'src/indexers/indexer-orchestrator.service';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private nearIndexer: IndexerOrchestratorService
    ) {}

    @Cron(CronExpression.EVERY_5_MINUTES)
    handleCron() {
      if (process.env.NODE_ENV === 'production') {
        this.logger.log('Trigger near indexer');
        this.nearIndexer.runIndexer();
      } else {
        this.logger.debug('Not in production environment. Skip near indexer trigger')
      }
    }

    @Cron(CronExpression.EVERY_HOUR)
    handleCronMissingTransactions() {
      if (process.env.NODE_ENV === 'production') {
        this.logger.log('Trigger near indexer for missing transactions');
        this.nearIndexer.runIndexerForMissing();
      } else {
        this.logger.debug('Not in production environment. Skip near indexer trigger')
      }
    }

}
