import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Transaction, Block } from '@internal/prisma/client';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { BuyTransactionService } from './providers/buy-transaction.service';
import { ListTransactionService } from './providers/list-transaction.service';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { UnlistTransactionService } from './providers/unlist-transaction.service';
import * as moment from 'moment';
import { TxHelperService } from './providers/tx-helper.service';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class NearIndexerService {
  private readonly logger = new Logger(NearIndexerService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @InjectConnection('near-streamer') private readonly connection: Connection,
    private buyTransaction: BuyTransactionService,
    private listTransaction: ListTransactionService,
    private unlistTransaction: UnlistTransactionService,
    private txHelper: TxHelperService
  ) { }
  
  async fetchTransactions(missing: boolean = false) {
    const smartContractFunctions = await this.prismaService.smartContractFunction.findMany();
    const smartContracts = await this.prismaService.smartContract.findMany();
    const whitelistedActions = smartContractFunctions.map(func => func.function_name);
    const accounts = smartContracts.map(sc => sc.contract_key);
    const cursor = this.connection.db.collection('transactions').aggregate([
      {
        $match: {
          'block.block_height': { $gte: 65000000 },
          'transaction.receiver_id': { $in: accounts },
          'transaction.actions.FunctionCall.method_name': { $in: whitelistedActions },
          ... (missing && { missing: true }),
          ... (!missing && {
            $and: [
              { $or: [{ processed: { $exists: false } }, { processed: false }] },
              { $or: [{ missing: { $exists: false } }, { missing: false }] },
            ] 
          })
        }
      },
      { $sort: { 'block.block_height': 1, 'transaction.nonce': 1 } },
      {
          $lookup: {
               from: "receipts",
               localField: "outcome.execution_outcome.outcome.status.SuccessReceiptId",
               foreignField: 'receipt.receipt_id',
               as: 'receipt'
            }
      }, { $unwind: { path: '$receipt'}},
      {
        $match: { 
            $or: [
                {'receipt.execution_outcome.outcome.status.SuccessValue': { $exists: true }},
                {'receipt.execution_outcome.outcome.status.SuccessReceiptId': { $exists: true }}
            ]
            
        }    
      },
    ], { allowDiskUse: true });

    return cursor;
  }

  async runIndexer() {
    this.logger.debug('runIndexer() Initialize');

    const cursor = await this.fetchTransactions(false);
    this.logger.debug('Processing transactions');

    for await (const doc of cursor) {
      const transaction: Transaction = <Transaction>doc;
      const txResult: TxProcessResult = await this.processTransaction(transaction);
      await this.setTransactionResult(doc._id, txResult);
    }

    await delay(5000);

    this.logger.debug('runIndexer() Completed');
  }

  async runIndexerForMissing() {
    this.logger.debug('runIndexerForMissing() Initialize');

    const cursor = await this.fetchTransactions(true);
    this.logger.debug('Processing missing transactions');

    for await (const doc of cursor) {
      const transaction: Transaction = <Transaction>doc;
      const txResult: TxProcessResult = await this.processTransaction(transaction);
      await this.setTransactionResult(doc._id, txResult);
    }

    await delay(5000);

    this.logger.debug('runIndexerForMissing() Completed');
  }

  async processTransaction(transaction: Transaction): Promise<TxProcessResult> {
    let result: TxProcessResult = { processed: transaction.processed, missing: transaction.missing };

    try {
      const method_name = transaction.transaction.actions[0].FunctionCall.method_name;

      const notify = moment(new Date(this.txHelper.nanoToMiliSeconds(transaction.block.timestamp))).utc() >
        moment().subtract(2, 'hours').utc() ? true : false;

      const finder = {
        where: { contract_key: transaction.transaction.receiver_id },
        include: { smart_contract_functions: true }
      };

      const smart_contract = await this.prismaService.smartContract.findUnique(finder);

      let smart_contract_function = smart_contract.smart_contract_functions.find(f => f.function_name === method_name);
      if (smart_contract && smart_contract_function) {
        const txHandler = this.getMicroIndexer(smart_contract_function.name)
        result = await txHandler.process(transaction, smart_contract, smart_contract_function, notify);
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

  getMicroIndexer(name: string) {
    const microIndexer = this[name + 'Transaction'];
    if (!microIndexer) {
      throw new Error(`No service defined for the context: ${name}`);
    }
    return microIndexer;
  }

  async setTransactionResult(id: string, result: TxProcessResult) {
    if (result.processed || result.missing) {
      await this.connection.db.collection('transactions').findOneAndUpdate({ _id: id }, {
        $set: {
          processed: result.processed,
          missing: result.missing
        }
      });
    }
  }
}
