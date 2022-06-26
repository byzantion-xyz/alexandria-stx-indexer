import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BuyTransactionService } from './providers/buy-transaction.service';
import { ListTransactionService } from './providers/list-transaction.service';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { UnlistTransactionService } from './providers/unlist-transaction.service';
import * as moment from 'moment';
import { TxHelperService } from './providers/tx-helper.service';
import { Transaction } from './dto/near-transaction.dto';
import { NearTxStreamAdapterService } from './providers/near-tx-stream-adapter.service';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class NearIndexerService {
  private readonly logger = new Logger(NearIndexerService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private nearTxStreamAdapter: NearTxStreamAdapterService,
    private buyTransaction: BuyTransactionService,
    private listTransaction: ListTransactionService,
    private unlistTransaction: UnlistTransactionService,
    private txHelper: TxHelperService
  ) { }
  
  async runIndexer() {
    this.logger.debug('runIndexer() Initialize');

    const txs: Transaction[] = await this.nearTxStreamAdapter.fetchTxs();
    await this.processTransactions(txs);

    this.logger.debug('runIndexer() Completed');
  }

  async runIndexerForMissing() {
    this.logger.debug('runIndexerForMissing() Initialize');
    
    const txs = await this.nearTxStreamAdapter.fetchMissingTxs();
    await this.processTransactions(txs);
    
    this.logger.debug('runIndexerForMissing() Completed');
  }

  async processTransactions(transactions: Transaction[]) {
    for await (const doc of transactions) {
      const transaction: Transaction = <Transaction>doc;
      const txResult: TxProcessResult = await this.processTransaction(transaction);
      await this.nearTxStreamAdapter.setTxResult(doc.hash, txResult);
    }

    await delay(5000);
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
          this.logger.log(`function_name: ${method_name} not found in ${transaction.transaction.receiver_id}`);
          result.missing = true;
        }
      } else {
        this.logger.log(`smart_contract: ${transaction.transaction.receiver_id} not found`);
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
}
