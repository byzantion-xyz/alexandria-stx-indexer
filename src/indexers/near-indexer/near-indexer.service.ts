import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Transaction, Block } from '@internal/prisma/client';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { BuyTransactionService } from './providers/buy-transaction.service';
import { ListingTransactionService } from './providers/listing-transaction.service';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { SmartContractService } from 'src/common/services/smart-contract/smart-contract.service';
import { UnlistTransactionService } from './providers/unlist-transaction.service';
import * as moment from 'moment';
import { TxHelperService } from './providers/tx-helper.service';

@Injectable()
export class NearIndexerService {
  private readonly logger = new Logger(NearIndexerService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @InjectConnection('near-streamer') private readonly connection: Connection,
    private buyTransaction: BuyTransactionService,
    private smartContractService: SmartContractService,
    private listingTransaction: ListingTransactionService,
    private unlistTransaction: UnlistTransactionService,
    private txHelper: TxHelperService
  ) { }

  async runIndexer() {
    this.logger.debug('Initialize');

    const cursor = this.connection.db.collection('transactions').aggregate([
      {
        $match: {
          $and: [
            { $or: [{ processed: { $exists: false } }, { processed: false }] },
            { $or: [{ missing: { $exists: false } }, { missing: false }] },
          ]
        }
      },
      {
        $lookup: {
          from: 'blocks',
          localField: 'outcome.execution_outcome.block_hash',
          foreignField: 'hash',
          as: 'block'
        }
      },
      { $unwind: { path: '$block' }},
      { $sort: { 'block.block_height': 1 }},
      { $limit: 1 }
    ]);

    this.logger.debug('Processing transactions');

    for await (const doc of cursor) {
      const block = <Block>doc.block;
      const transaction: Transaction = <Transaction>doc;
      const method_name = transaction.transaction.actions[0].FunctionCall.method_name;

      const notify = moment(new Date(this.txHelper.nanoToMiliSeconds(block.timestamp))).utc() >
        moment().subtract(1, 'days').utc() ? true : false;

      const finder = {
        where: { contract_key: transaction.transaction.receiver_id },
        include: { smart_contract_functions: true }
      };

      const smart_contract = await this.prismaService.smartContract.findUnique(finder);
      let result: TxProcessResult = { processed: transaction.processed, missing: transaction.missing };
      let smart_contract_function = smart_contract.smart_contract_functions.find(f => f.function_name === method_name);
      if (smart_contract && smart_contract_function) {
        const txHandler = this.getTxHandler(smart_contract_function.name)
        result = await txHandler.process(transaction, block, smart_contract, smart_contract_function, notify);
      } else {
        this.logger.log(`function_name: ${method_name} not found in ${transaction.transaction.receiver_id}`);
        result.missing = true;
      }

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
