import { Logger, Injectable, Provider, Inject } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { Client } from "pg";
import { CommonTx } from "./common/interfaces/common-tx.interface";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Chain } from "src/database/universal/entities/Chain";
import { CommonTxResult, ProcessedTxsResult, TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { IndexerService } from "./common/interfaces/indexer-service.interface";
import { IndexerOptions } from "./common/interfaces/indexer-options";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { CommonUtilService } from "src/common/helpers/common-util/common-util.service";
import { MissingCollectionService } from "src/scrapers/near-scraper/providers/missing-collection.service";
import { SmartContractService } from "./common/helpers/smart-contract.service";

const BATCH_SIZE = 1000;

@Injectable()
export class IndexerOrchestratorService {
  private chainSymbol: string;
  private genericScf: SmartContractFunction[] = [];
  private readonly logger = new Logger(IndexerOrchestratorService.name);

  constructor(
    @Inject('MicroIndexers') private microIndexers: Array<IndexerService>,
    private configService: ConfigService,
    @InjectRepository(Chain)
    private chainRepository: Repository<Chain>,
    @Inject('TxStreamAdapter') private txStreamAdapter: TxStreamAdapter,
    private commonUtil: CommonUtilService,
    private missingCollectionService: MissingCollectionService,
    private smartContractService: SmartContractService
  ) {}

  async runIndexer(options: IndexerOptions) {
    this.logger.log(`runIndexer() Initialize with options: `, options);
    try {
      await this.setUpChainAndStreamer();
      if (options.includeMissings && !options.contract_key) {
        this.logger.warn('A contract_key is required while running missing transactions');
        return;
      }

      const scs = await this.smartContractService.findChainSmartContracts(this.chainSymbol);

      await this.txStreamAdapter.connectPool();
      const { cursor } = await this.txStreamAdapter.fetchTxs(options);

      let txs = [];
      this.logger.log(`Querying transactions cursor batch_size: ${BATCH_SIZE} `);
      do {
        txs = await cursor.read(BATCH_SIZE);
        this.logger.log(`Fetching next batch of transactions`);
        const common_txs: CommonTx[] = this.txStreamAdapter.transformTxs(txs);
        await this.processTransactions(common_txs, scs);
      } while (txs.length > 0);

      cursor.close();
      await this.txStreamAdapter.closePool();

      this.logger.log(`runIndexer() Completed with options: `, options);
    } catch (err) {
      this.logger.error(err);
    }
  }

  async subscribeToEvents() {
    this.logger.debug(`subscribeToEvents() Initialize`);

    try {
      await this.setUpChainAndStreamer();
      if (this.isTxStreamAdapterWithSubsriptions(this.txStreamAdapter)) {
        const client: Client = this.txStreamAdapter.subscribeToEvents();

        client.on("notification", async (event) => {
          const txs: CommonTx[] = await this.txStreamAdapter.fetchEventData(event.payload);

          await this.processTransactions(txs);
        });
      } else {
        this.logger.debug('subscribeToEvents() Current stream adapter does not support subscriptions');
      }
    } catch (err) {
      this.logger.error(err);
    }
  }

  async processTransactions(transactions: CommonTx[], scs?: SmartContract[]): Promise<ProcessedTxsResult> {
    let processed = 0;
    
    for await (const tx of transactions) {
      let sc: SmartContract;
      if (scs) {
        sc = scs.find(sc => sc.contract_key === tx.receiver);
      }
      const txResult: TxProcessResult = await this.processTransaction(tx, sc);
      if (txResult.processed) processed++;
      this.txStreamAdapter.setTxResult(tx, txResult);
    }

    if (transactions && transactions.length) {
      this.txStreamAdapter.saveTxResults();
    }

    return { total: processed };
  }

  async processTransaction(transaction: CommonTx, smart_contract?: SmartContract): Promise<TxProcessResult> {
    let result: TxProcessResult = { processed: false, missing: false };

    try {
      const method_name = transaction.function_name;
      if (!smart_contract) {
        smart_contract = await this.smartContractService.findByContractKey(transaction.receiver, this.chainSymbol);
      }

      if (smart_contract) {
        let smart_contract_function =
          smart_contract.smart_contract_functions.find(
            (f) => f.function_name === method_name
          );

        if (!smart_contract_function && this.genericScf && this.genericScf.length) {
          smart_contract_function = this.genericScf.find((f) => f.function_name === method_name);
        }

        if (smart_contract_function) {
          const txHandler = this.getMicroIndexer(transaction.indexer_name || smart_contract_function.name);
          this.logger.log(`process() ${transaction.hash} with: ${txHandler.constructor.name} `);
          result = await txHandler.process(
            transaction,
            smart_contract,
            smart_contract_function
          );
        } else {
          this.logger.debug(`function_name: ${method_name} not found in ${transaction.receiver}`);
          result.missing = true;
        }
      } else {
        this.logger.debug(`smart_contract: ${transaction.receiver} not found`);
        if (this.chainSymbol === 'Near' && process.env.NODE_ENV === 'production') {
          //this.missingCollectionService.scrapeMissing({ contract_key: transaction.receiver });
        }
        result.missing = true;
      }
    } catch (err) {
      this.logger.error(
        `Error processing transaction with hash: ${transaction.hash}`
      );
      this.logger.error(err);
    } finally {
      return result;
    }
  }

  getMicroIndexer(name: string) {
    const indexerName = this.commonUtil.toPascalCase(name) + "IndexerService";
    let microIndexer = this.microIndexers.find(indexer => indexer.constructor.name === indexerName);
    if (!microIndexer || !this.isMicroIndexer(microIndexer)) {
      throw new Error(`No micro indexer defined for the context: ${name}`);
    }
    return microIndexer;
  }

  async setUpChainAndStreamer() {
    this.chainSymbol = this.configService.get("indexer.chainSymbol");
    if (!this.chainSymbol) {
      throw new Error(`CHAIN_SYMBOL must be provided as environment variable`);
    }
    const chain = await this.chainRepository.findOneByOrFail({ symbol: this.chainSymbol });

    if (
      !this.txStreamAdapter ||
      !this.isTxStreamAdapter(this.txStreamAdapter)
    ) {
      throw new Error(`No stream adapter defined for chain: ${this.chainSymbol}`);
    }

    // Load generic functinos per chain (i.e transfer)
    const functions = this.configService.get("indexer.genericFunctions")[this.chainSymbol];
    for (let genericFunction of functions) {
      const scf = new SmartContractFunction();
      scf.function_name = genericFunction.function_name;
      scf.name = genericFunction.name;
      scf.args = genericFunction.args;
      this.genericScf.push(scf);
    }
  }

  isTxStreamAdapter(arg): arg is TxStreamAdapter {
    return (
      typeof arg.fetchTxs === 'function' &&
      typeof arg.setTxResult === 'function' &&
      typeof arg.saveTxResults === 'function' &&
      typeof arg.connectPool === 'function' &&
      typeof arg.closePool === 'function'
    );
  }

  isTxStreamAdapterWithSubsriptions(arg): arg is TxStreamAdapter {
    return this.isTxStreamAdapter(arg) &&
      typeof arg.subscribeToEvents === 'function' &&
      typeof arg.fetchEventData === 'function';
  }

  isMicroIndexer(arg) {
    return (
      (arg as IndexerService).process !== undefined &&
      (arg as IndexerService).createAction !== undefined
    );
  }
}
