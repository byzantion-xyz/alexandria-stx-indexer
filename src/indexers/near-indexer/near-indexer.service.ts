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

    const transactions: Transaction[] = await this.prismaMongoService.transaction.findMany();
    this.logger.debug('Processing %d transactions', transactions.length);

    for (let transaction of transactions) {
      let method_name = transaction.transaction.actions[0].FunctionCall.method_name;

      let finder = {
        where: { contract_key: transaction.transaction.receiver_id },
        include: { smart_contract_functions: true }
      };
      const smart_contract = await this.prismaService.smartContract.findUnique(finder);

      let smart_contract_function = smart_contract.smart_contract_functions.find(f => f.function_name === method_name);

      const result = await this.getTxHandler(smart_contract_function.function_name)
        .process(transaction, smart_contract, smart_contract_function);
    }

    this.logger.debug('Completed');
  }

  getTxHandler(name: string) {
    switch (name) {
      case 'buy': return this.buyTransaction;
      case 'list': return this.listingTransaction;
      default: throw new Error(`No service defined for the context: ${name}`);
    }
  }

}
