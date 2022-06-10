import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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
    let smartContractFunctions = await this.prismaService.smartContractFunction.findMany();

    const whitelistedActions = smartContractFunctions.map(func => func.function_name);

    const cursor = this.connection.db.collection('transactions').aggregate([
      {
        $match: {
          'transaction.actions.FunctionCall.method_name': { $in: whitelistedActions },
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
      { $unwind: { path: '$block' } },
      { $sort: { 'block.block_height': 1 } },
      { $limit: 1 }
    ]);

    this.logger.debug('Processing transactions');

    for await (const doc of cursor) {
      const block = <Block>doc.block;
      const transaction: Transaction = <Transaction>doc;
      const txResult: TxProcessResult = await this.processTransaction(transaction, block);
      await this.setTransactionResult(transaction.id, txResult);
    }

    this.logger.debug('Completed');
  }

  async processTransaction(transaction: Transaction, block: Block): Promise<TxProcessResult> {
    let result: TxProcessResult = { processed: transaction.processed, missing: transaction.missing };

    try {
      const method_name = transaction.transaction.actions[0].FunctionCall.method_name;

      const notify = moment(new Date(this.txHelper.nanoToMiliSeconds(block.timestamp))).utc() >
        moment().subtract(2, 'hours').utc() ? true : false;

      const finder = {
        where: { contract_key: transaction.transaction.receiver_id },
        include: { smart_contract_functions: true }
      };

      const smart_contract = await this.prismaService.smartContract.findUnique(finder);

      let smart_contract_function = smart_contract.smart_contract_functions.find(f => f.function_name === method_name);
      if (smart_contract && smart_contract_function) {
        const txHandler = this.getTxHandler(smart_contract_function.name)
        result = await txHandler.process(transaction, block, smart_contract, smart_contract_function, notify);
      } else {
        this.logger.log(`function_name: ${method_name} not found in ${transaction.transaction.receiver_id}`);
        result.missing = true;
      }
    } catch (err) {
      this.logger.error(`Error processing transaction with hash: ${transaction.transaction.hash}`);
      this.logger.error(err);
    } finally {
      return result;
    }
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
      await this.connection.db.collection('transactions').findOneAndUpdate({ id: id }, {
        $set: {
          processed: result.processed,
          missing: result.missing
        }
      });
    }
  }

}
