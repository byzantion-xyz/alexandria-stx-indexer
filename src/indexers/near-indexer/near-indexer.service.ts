import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BuyTransactionService } from '../common/providers/buy-transaction.service';
import { ListTransactionService } from '../common/providers/list-transaction.service';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { UnlistTransactionService } from '../common/providers/unlist-transaction.service';

import { TxHelperService } from './providers/tx-helper.service';
import { NearTxStreamAdapterService } from './providers/near-tx-stream-adapter.service';
import { CommonTx } from '../common/interfaces/common-tx.interface';

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

    const txs: CommonTx[] = await this.nearTxStreamAdapter.fetchTxs();
    await this.processTransactions(txs);

    this.logger.debug('runIndexer() Completed');
  }

  async runIndexerForMissing() {
    this.logger.debug('runIndexerForMissing() Initialize');
    
    const txs: CommonTx[] = await this.nearTxStreamAdapter.fetchMissingTxs();
    await this.processTransactions(txs);
    
    this.logger.debug('runIndexerForMissing() Completed');
  }

  async processTransactions(transactions: CommonTx[]) {
    for await (const tx of transactions) {
      const txResult: TxProcessResult = await this.processTransaction(tx);
      await this.nearTxStreamAdapter.setTxResult(tx.hash, txResult);
    }

    await delay(5000);
  }

  async processTransaction(transaction: CommonTx): Promise<TxProcessResult> {
    let result: TxProcessResult = { processed: false, missing: false };

    try {
      const method_name = transaction.function_name;
      const finder = {
        where: { contract_key: transaction.receiver },
        include: { smart_contract_functions: true }
      };

      const smart_contract = await this.prismaService.smartContract.findUnique(finder);

      if (smart_contract) {
        let smart_contract_function = smart_contract.smart_contract_functions.find(f => f.function_name === method_name);
        if (smart_contract_function) {
          const txHandler = this.getMicroIndexer(smart_contract_function.name)
          result = await txHandler.process(transaction, smart_contract, smart_contract_function);
        } else {
          this.logger.log(`function_name: ${method_name} not found in ${transaction.receiver}`);
          result.missing = true;
        }
      } else {
        this.logger.log(`smart_contract: ${transaction.receiver} not found`);
        result.missing = true;
      }
    } catch (err) {
      this.logger.error(`Error processing transaction with hash: ${transaction.hash}`);
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
