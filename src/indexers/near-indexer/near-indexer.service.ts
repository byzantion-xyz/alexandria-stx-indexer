import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BuyTransactionService } from './providers/buy-transaction.service';
import { ListTransactionService } from './providers/list-transaction.service';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { UnlistTransactionService } from './providers/unlist-transaction.service';
import * as moment from 'moment';
import { TxHelperService } from './providers/tx-helper.service';
import { PrismaStreamerService } from 'src/prisma/prisma-streamer.service';
import { Transaction } from './dto/near-transaction.dto';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class NearIndexerService {
  private readonly logger = new Logger(NearIndexerService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly prismaStreamerService: PrismaStreamerService,
    private buyTransaction: BuyTransactionService,
    private listTransaction: ListTransactionService,
    private unlistTransaction: UnlistTransactionService,
    private txHelper: TxHelperService
  ) { }
  
  async fetchTransactions(missing: boolean = false): Promise<Transaction[]> {
    const smartContracts = await this.prismaService.smartContract.findMany();
    const accounts = smartContracts.map(sc => sc.contract_key);
    let accounts_in = "";
    for (let i in accounts) {
      accounts_in += `'${accounts[i]}',`;
    }
    accounts_in = accounts_in.slice(0, -1);

    const result: Transaction[] = await this.prismaStreamerService.$queryRawUnsafe(`
      select * from transaction t inner join receipt r on t.success_receipt_id =r.receipt_id
      where block_height >= 65000000 and 
      receiver_id in (${accounts_in}) AND 
      processed = false AND 
      missing = ${missing} AND
      (( execution_outcome->'outcome'->'status'->'SuccessValue' is not null)
      or (execution_outcome->'outcome'->'status'->'SuccessReceiptId' is not null))
      order by t.block_height limit 3000;
    `);

    return result;
  }

  async runIndexer() {
    this.logger.debug('runIndexer() Initialize');

    const rows: Transaction[] = await this.fetchTransactions(false);
    this.logger.debug('Processing transactions');

    for await (const doc of rows) {
      const transaction: Transaction = doc;

      const txResult: TxProcessResult = await this.processTransaction(transaction);
      await this.setTransactionResult(doc.hash, txResult);
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
      await this.setTransactionResult(doc.hash, txResult);
    }

    await delay(5000);

    this.logger.debug('runIndexerForMissing() Completed');
  }

  async processTransaction(transaction: Transaction): Promise<TxProcessResult> {
    let result: TxProcessResult = { processed: transaction.processed, missing: transaction.missing };

    try {
      const method_name = transaction.transaction.actions[0].FunctionCall?.method_name;

      const notify = moment(new Date(this.txHelper.nanoToMiliSeconds(transaction.block_timestamp))).utc() >
        moment().subtract(2, 'hours').utc() ? true : false;

      const finder = {
        where: { contract_key: transaction.transaction.receiver_id },
        include: { smart_contract_functions: true }
      };

      const smart_contract = await this.prismaService.smartContract.findUnique(finder);

      if (smart_contract) {
        let smart_contract_function = smart_contract.smart_contract_functions.find(f => f.function_name === method_name);
        if (smart_contract_function) {
          const txHandler = this.getMicroIndexer(smart_contract_function.name)
          result = await txHandler.process(transaction, smart_contract, smart_contract_function, notify);
        } else {
          result.missing = true;
        }
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

  async setTransactionResult(hash: string, result: TxProcessResult) {
    if (result.processed || result.missing) {
      await this.prismaStreamerService.transaction.update({ where: { hash }, data: { 
        processed: result.processed,
        missing: result.missing
      }});
    }
  }
}
