import { Body, Controller, HttpException, HttpStatus, Post, UsePipes, ValidationPipe } from '@nestjs/common';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndexerOptions } from './common/interfaces/indexer-options';
import { IndexerOrchestratorService } from './indexer-orchestrator.service';

interface TransactionsDto {
  contract_key?: string;
  start_block_height?: number;
  end_block_height?: number;
}

@Controller('indexer')
export class IndexerController {
  private readonly logger = new Logger(IndexerController.name);

  constructor(
    private indexerOrchestrator: IndexerOrchestratorService,
    private configService: ConfigService
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

    const blockConfig = this.configService.get('indexer.blockRanges')[this.configService.get('indexer.chainSymbol')];
    // TODO: Query block when contract was deployed and latest block.
    const initial_block = Number(options.start_block_height) || Number(blockConfig.start_block_height);
    const end_block: number = options.end_block_height || blockConfig.end_block_height;
    const block_range: number = blockConfig.block_range;
    for (let b = initial_block; b < end_block; b = Number(b + block_range)) {      
      options.start_block_height = b;
      options.end_block_height = Number(b) + Number(block_range);
 
      await this.indexerOrchestrator.runIndexer(options);
    }

    return 'Ok';
  }

}