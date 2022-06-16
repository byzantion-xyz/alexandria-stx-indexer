import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NearIndexerService } from 'src/indexers/near-indexer/near-indexer.service';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private nearIndexer: NearIndexerService
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    handleCron() {
      this.logger.debug('Trigger near indexer');
      this.nearIndexer.runIndexer();
    }

}
