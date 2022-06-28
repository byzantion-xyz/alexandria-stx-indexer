import { Controller, Post } from '@nestjs/common';

import { Logger } from '@nestjs/common';
import { IndexerOrchestratorService } from '../indexer-orchestrator.service';

@Controller('near-indexer')
export class NearIndexerController {
  private readonly logger = new Logger(NearIndexerController.name);

  constructor(
    private nearIndexer: IndexerOrchestratorService
  ) { }

  @Post('run')
  async indexTransactions() {
    if (process.env.NODE_ENV !== 'production') {
      this.nearIndexer.runIndexer();
    }

    return 'Ok';
  }

  @Post('run-missing')
  async indexMissingTransactions() {
    this.nearIndexer.runIndexerForMissing();
    
    return 'Ok';
  }

}
