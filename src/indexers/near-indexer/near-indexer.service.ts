import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Transaction, Block } from '@internal/prisma/client';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { BuyTransactionService } from './buy-transaction/buy-transaction.service';
import { ListingTransactionService } from './listing-transaction/listing-transaction.service';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { SmartContractService } from 'src/common/services/smart-contract/smart-contract.service';
import { UnlistTransactionService } from './unlist-transaction/unlist-transaction.service';

@Injectable()
export class NearIndexerService {
  private readonly logger = new Logger(NearIndexerService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @InjectConnection('near-streamer') private readonly connection: Connection,
    private buyTransaction: BuyTransactionService,
    private smartContractService: SmartContractService,
    private listingTransaction: ListingTransactionService,
    private unlistTransaction: UnlistTransactionService
  ) { }

  async runIndexer() {
    this.logger.debug('Initialize');

    const cursor = this.connection.db.collection('transactions').aggregate([
      {
        $match: {
          $and: [
            { $or: [{ processed: { $exists: false } }, { processed: false }] },
            { $or: [{ processed: { $exists: false } }, { processed: false }] },
          ]
        }
      },
      {
        $lookup: {
          from: 'blocks',
          localField: 'transaction.outcome.execution_outcome.block_hash',
          foreignField: 'hash',
          as: 'block'
        }
      },
      { $limit: 50 }
    ]);

    this.logger.debug('Processing transactions');

    for await (const doc of cursor) {
      let transaction: Transaction = <Transaction>doc;
      let method_name = transaction.transaction.actions[0].FunctionCall.method_name;

      let finder = {
        where: { contract_key: transaction.transaction.receiver_id },
        include: { smart_contract_functions: true }
      };
      const smart_contract = await this.prismaService.smartContract.findUnique(finder);

      let smart_contract_function = smart_contract.smart_contract_functions.find(f => f.function_name === method_name);

      const txHandler = this.getTxHandler(smart_contract_function.function_name)
      const result: TxProcessResult = await txHandler.process(transaction, doc.block, smart_contract, smart_contract_function);

      await this.setTransactionResult(transaction.id, result);
    }

    this.logger.debug('Completed');
  }

  getTxHandler(name: string) {
    switch (name) {
      case 'buy': return this.buyTransaction;
      case 'list': return this.listingTransaction;
      case 'unlist': return this.unlistTransaction;
      default: throw new Error(`No service defined for the context: ${name}`);
    }
  }

  async setTransactionResult(id: string, result: TxProcessResult) {
    if (result.processed || result.missing) {
      this.connection.db.collection('transactions').findOneAndUpdate({ id: id }, {
        $set: {
          processed: result.processed,
          missing: result.missing
        }
      });
    }
  }

}
