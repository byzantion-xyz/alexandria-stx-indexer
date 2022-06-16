import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NearIndexerService } from 'src/indexers/near-indexer/near-indexer.service';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private nearIndexer: NearIndexerService
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

}
