import { Logger, Injectable } from '@nestjs/common';
import { PrismaService as PrismaMongoService } from 'src/prisma.mongo.service';
import { Transaction } from '@internal/prisma/client';
import { BuyTransactionService } from './buy-transaction/buy-transaction.service';

@Injectable()
export class NearIndexerService {
  private readonly logger = new Logger(NearIndexerService.name);

  constructor(
    private readonly prismaMongoService: PrismaMongoService,
    private buyTransaction: BuyTransactionService
  ) { }

  async runIndexer() {
    this.logger.debug('Initialize');

    const transactions: Transaction[] = await this.prismaMongoService.transaction.findMany();
    // TODO: Load marketplaces from SQL database
    this.logger.debug('Processing %d transactions', transactions.length);

    for (let transaction of transactions) {
      let method_name = transaction.transaction.actions[0].FunctionCall.method_name;

      switch (method_name) {
        case 'buy': this.buyTransaction.process(transaction);
          break;

        default: this.logger.debug(`Transaction method_name: ${method_name} not processed `);
      }
      
    }

    this.logger.debug('Completed');
  }

}
