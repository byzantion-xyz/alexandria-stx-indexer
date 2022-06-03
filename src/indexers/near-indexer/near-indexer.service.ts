import { Logger, Injectable } from '@nestjs/common';
import { PrismaService as PrismaMongoService } from 'src/prisma.mongo.service';
import { PrismaService } from 'src/prisma.service';
import { Transaction } from '@internal/prisma/client';
import { SmartContractType } from '@prisma/client';

import { BuyTransactionService } from './buy-transaction/buy-transaction.service';
import { ListingTransactionService } from './listing-transaction/listing-transaction.service';

@Injectable()
export class NearIndexerService {
  private readonly logger = new Logger(NearIndexerService.name);

  constructor(
    private readonly prismaMongoService: PrismaMongoService,
    private readonly prismaService: PrismaService,
    private buyTransaction: BuyTransactionService,
    private listingTransaction: ListingTransactionService
  ) { }

  async runIndexer() {
    this.logger.debug('Initialize');

    let finder = { where: { contract_key: 'marketplace.paras.near' }};

    const transactions: Transaction[] = await this.prismaMongoService.transaction.findMany();
    this.logger.debug('Processing %d transactions', transactions.length);

    for (let transaction of transactions) {
      let finder = { where: { 
        contract_key: transaction.transaction.receiver_id, 
        type: SmartContractType.marketplace
      }};
      const smart_contract = await this.prismaService.smartContract.findFirst(finder);

      let method_name = transaction.transaction.actions[0].FunctionCall.method_name;

      switch (method_name) {
        case 'buy': this.buyTransaction.process(transaction);
          break;

        case 'list': this.listingTransaction.process(transaction);
          break;

        default: this.logger.debug(`Transaction method_name: ${method_name} not processed `);
      }
      
    }

    this.logger.debug('Completed');
  }

}
