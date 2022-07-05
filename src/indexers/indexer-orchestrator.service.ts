import { Logger, Injectable } from '@nestjs/common';
//import { PrismaService } from 'src/prisma/prisma.service';
import { BuyIndexerService } from './common/providers/buy-indexer.service';
import { ListIndexerService } from './common/providers/list-indexer.service';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { UnlistIndexerService } from './common/providers/unlist-indexer.service';

import { NearTxStreamAdapterService } from './near-indexer/providers/near-tx-stream-adapter.service';
import { CommonTx } from './common/interfaces/common-tx.interface';
import { SmartContract } from 'src/entities/SmartContract';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class IndexerOrchestratorService {
  private readonly logger = new Logger(IndexerOrchestratorService.name);

  constructor(
    //private readonly prismaService: PrismaService,
    private nearTxStreamAdapter: NearTxStreamAdapterService,
    private buyIndexer: BuyIndexerService,
    private listIndexer: ListIndexerService,
    private unlistIndexer: UnlistIndexerService,
    @InjectRepository(SmartContract) private smartContractRepository: Repository<SmartContract>
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
      
      // Prisma
      //const finder = {
      //  where: { contract_key: transaction.receiver },
      //  include: { smart_contract_functions: true }
      //};
      //const smart_contract = await this.prismaService.smartContract.findUnique(finder);
      
      // TypeORM
      const finder = {
        where: { contract_key: 'asac.near' },
        relations: { smart_contract_functions: true }
      };
      const smart_contract = await this.smartContractRepository.findOne(finder);

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
    const microIndexer = this[name + 'Indexer'];
    if (!microIndexer) {
      throw new Error(`No service defined for the context: ${name}`);
    }
    return microIndexer;
  }
}
