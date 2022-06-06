import { Logger, Injectable } from '@nestjs/common';
import { PrismaService as PrismaMongoService } from 'src/prisma.mongo.service';
import { PrismaService } from 'src/prisma.service';
import { Transaction, Block } from '@internal/prisma/client';

import { BuyTransactionService } from './buy-transaction/buy-transaction.service';
import { ListingTransactionService } from './listing-transaction/listing-transaction.service';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';


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

    const transactions: Transaction[] = await this.prismaMongoService.transaction.findMany({
      where: {
        processed: false,
        missing: false
      },
      orderBy: [{ transaction: { nonce: 'asc' }}],
    });
    
    this.logger.debug('Processing %d transactions', transactions.length);

    for (let transaction of transactions) {
      let block: Block = await this.prismaMongoService.block.findFirst({
        where: {
          hash: transaction.outcome.execution_outcome.block_hash
        }
      });

      let method_name = transaction.transaction.actions[0].FunctionCall.method_name;

      let finder = {
        where: { contract_key: transaction.transaction.receiver_id },
        include: { smart_contract_functions: true }
      };
      const smart_contract = await this.prismaService.smartContract.findUnique(finder);

      let smart_contract_function = smart_contract.smart_contract_functions.find(f => f.function_name === method_name);

      const txHandler = this.getTxHandler(smart_contract_function.function_name)
      const result: TxProcessResult = await txHandler.process(transaction, block, smart_contract, smart_contract_function);

      if (result.processed || result.missing) {
        this.prismaMongoService.transaction.update({
          where: { id: transaction.id },
          data: {
            missing: false,
            processed: false
          }
        });
      }

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
