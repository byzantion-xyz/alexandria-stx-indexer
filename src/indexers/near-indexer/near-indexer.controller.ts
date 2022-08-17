import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';

import { Logger } from '@nestjs/common';
import { IndexerOptions } from '../common/interfaces/indexer-options';
import { IndexerOrchestratorService } from '../indexer-orchestrator.service';

interface TransactionsDto {
  contract_key?: string;
  start_block_height?: number;
  end_block_height?: number;
}

@Controller('indexer')
export class NearIndexerController {
  private readonly logger = new Logger(NearIndexerController.name);

  constructor(
    private nearIndexer: IndexerOrchestratorService
  ) { }

  @Post('run')
  async indexTransactions(@Body() params: TransactionsDto) {
    if (process.env.NODE_ENV !== 'production') {
      this.nearIndexer.runIndexer({ 
        includeMissings: false,
        ...params
      });
    }

    return 'Ok';
  }

  @Post('run-missing')
  @UsePipes(new ValidationPipe({ transform: true }))
  async indexMissingTransactions(@Body() params: TransactionsDto) {
    const indexerOptions: IndexerOptions = {
      includeMissings: true, 
      ...params
    }
    this.nearIndexer.runIndexer(indexerOptions);

    return 'Ok';
  }

}