import { Body, Controller, HttpException, HttpStatus, Post, UsePipes, ValidationPipe } from '@nestjs/common';

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
    private indexerOrchestrator: IndexerOrchestratorService
  ) { }

  @Post('run')
  async indexTransactions(@Body() params: TransactionsDto) {
    if (process.env.NODE_ENV !== 'production') {
      this.indexerOrchestrator.runIndexer({ 
        includeMissings: false,
        ...params
      });
    }

    return 'Ok';
  }

  @Post('run-missing')
  @UsePipes(new ValidationPipe({ transform: true }))
  async indexMissingTransactions(@Body() params: TransactionsDto) {
    if (!params || !params.contract_key) {
      throw new HttpException('A valid contract_key is required', HttpStatus.BAD_REQUEST);  
    }

    const options: IndexerOptions = {
      includeMissings: true, 
      ...params
    }
    // TODO: Query block when contract was deployed and latest block.
    const initial_block = options.start_block_height || 42000000;
    const end_block = options.end_block_height || 80000000;
    const block_range = 1000000;

    for (let b = initial_block; b < end_block; b = b + block_range) {
      options.start_block_height = b;
      options.end_block_height = b + block_range;
 
      await this.indexerOrchestrator.runIndexer(options);
    }

    return 'Ok';
  }

}