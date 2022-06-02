import { Controller, Post } from '@nestjs/common';

import { Logger } from '@nestjs/common';
import { NearIndexerService } from './near-indexer.service';

@Controller('near-indexer')
export class NearIndexerController {
  private readonly logger = new Logger(NearIndexerController.name);

  constructor(
    private nearIndexer: NearIndexerService
  ) { }

  @Post('run')
  async indexTransactions() {
    this.nearIndexer.runIndexer();

    return 'Ok';
  }

}
