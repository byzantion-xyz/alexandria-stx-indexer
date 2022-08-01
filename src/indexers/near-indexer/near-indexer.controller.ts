import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';

import { Logger } from '@nestjs/common';
import { IndexerOptions } from '../common/interfaces/indexer-options';
import { IndexerOrchestratorService } from '../indexer-orchestrator.service';

interface MissingTransactionsDto {
  contract_key: string;
}


@Controller('near-indexer')
export class NearIndexerController {
  private readonly logger = new Logger(NearIndexerController.name);

  constructor(
    private nearIndexer: IndexerOrchestratorService
  ) { }

  @Post('run')
  async indexTransactions(@Body() params: MissingTransactionsDto) {
    if (process.env.NODE_ENV !== 'production') {
      this.nearIndexer.runIndexer({ 
        includeMissings: false,
        ... (params.contract_key && { contract_key: params.contract_key })
      });
    }

    return 'Ok';
  }

  @Post('run-missing')
  @UsePipes(new ValidationPipe({ transform: true }))
  async indexMissingTransactions(@Body() params: MissingTransactionsDto) {
    const indexerOptions: IndexerOptions = {
      includeMissings: true, 
      ... (params.contract_key && { contract_key: params.contract_key })
    }
    this.nearIndexer.runIndexer(indexerOptions);

    return 'Ok';
  }

}