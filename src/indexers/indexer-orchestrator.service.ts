import { Logger, Injectable, Provider, Inject } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { Client } from "pg";
import { CommonTx } from "./common/interfaces/common-tx.interface";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Chain } from "src/database/universal/entities/Chain";
import { ProcessedTxsResult, TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { IndexerService } from "./common/interfaces/indexer-service.interface";
import { IndexerOptions } from "./common/interfaces/indexer-options";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { CommonUtilService } from "src/common/helpers/common-util/common-util.service";
import { SmartContractService } from "./common/helpers/smart-contract.service";
import { TxHelperService } from "./common/helpers/tx-helper.service";
import { SmartContractType } from "./common/helpers/indexer-enums";

const BATCH_SIZE = 100;

@Injectable()
export class IndexerOrchestratorService {
  private chainSymbol: string;
  private genericScf: SmartContractFunction[] = [];
  private readonly logger = new Logger(IndexerOrchestratorService.name);
  private chainId: string;
  private scs: SmartContract[];

  constructor(
    @Inject('MicroIndexers') private microIndexers: Array<IndexerService>,
    private configService: ConfigService,
    private txHelper: TxHelperService,
    @InjectRepository(Chain)
    private chainRepository: Repository<Chain>,
    @Inject('TxStreamAdapter') private txStreamAdapter: TxStreamAdapter,
    private commonUtil: CommonUtilService,
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

      this.scs = await this.smartContractService.findChainSmartContracts(this.chainId);

      await this.txStreamAdapter.connectPool();
      const { cursor } = await this.txStreamAdapter.fetchTxs(options);

      let txs = [];
      this.logger.log(`Querying transactions cursor batch_size: ${BATCH_SIZE} `);
      do {
        txs = await cursor.read(BATCH_SIZE);
        this.logger.log(`Fetching next batch of transactions`);
        const common_txs: CommonTx[] = this.txStreamAdapter.transformTxs(txs);
        await this.processTransactions(common_txs);
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

  async processTransactions(transactions: CommonTx[]): Promise<ProcessedTxsResult> {
    let processed = 0;
    
    for await (const tx of transactions) {
      const txResult: TxProcessResult = await this.processTransaction(tx);
      if (txResult.processed) processed++;
      this.txStreamAdapter.setTxResult(tx, txResult);
    }

    if (transactions && transactions.length) {
      this.txStreamAdapter.saveTxResults();
    }

    return { total: processed };
  }

  async processTransaction(transaction: CommonTx): Promise<TxProcessResult> {
    let result: TxProcessResult = { processed: false, missing: false };

    try {
      const method_name = transaction.function_name;

      let sc = Array.isArray(this.scs)
        ? this.scs.find(sc => sc.contract_key === transaction.receiver) 
        : await this.smartContractService.findByContractKey(transaction.receiver, this.chainId);

      let scf = Array.isArray(this.genericScf) &&
        this.genericScf.find((f) => f.function_name === method_name);

      if (!sc && scf && this.chainSymbol === 'Near') {
        sc = await this.txHelper.createSmartContractSkeleton(transaction.receiver, this.chainId);
        sc.smart_contract_functions = [];
        if (Array.isArray(this.scs)) {
          this.scs.push(sc);
        }
      }

      if (sc) {
        if (!scf) {
          scf = sc.smart_contract_functions.find((f) => f.function_name === method_name);
        }

        if (scf) {
          const indexer_name = transaction.indexer_name || scf.name;
          const txHandler = this.getMicroIndexer(indexer_name);
          txHandler.stakingScs = Array.isArray(this.scs) && this.scs.filter(sc => sc.type.includes(SmartContractType.staking)); 
          txHandler.marketScs = Array.isArray(this.scs) && this.scs.filter(sc => sc.type.includes(SmartContractType.marketplace));

          if (txHandler) {
            this.logger.log(`process() ${transaction.hash} with: ${txHandler.constructor.name} `);
            result = await txHandler.process(transaction, sc, scf);
          } else {
            this.logger.debug(`No micro indexer defined for the context: ${indexer_name}`);
          }
        } else {
          this.logger.debug(`function_name: ${method_name} not found in ${transaction.receiver}`);
          result.missing = true;
        }
      } else {
        this.logger.debug(`smart_contract: ${transaction.receiver} not found for hash: ${transaction.hash}`);
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

  getMicroIndexer(name: string): IndexerService | null {
    const indexerName = this.commonUtil.toPascalCase(name) + "IndexerService";
    let microIndexer = this.microIndexers.find(indexer => indexer.constructor.name === indexerName);
   
    return this.isMicroIndexer(microIndexer) ? microIndexer : null; 
  }

  async setUpChainAndStreamer() {
    this.chainSymbol = this.configService.get("indexer.chainSymbol");
    if (!this.chainSymbol) {
      throw new Error(`CHAIN_SYMBOL must be provided as environment variable`);
    }
    const chain = await this.chainRepository.findOneByOrFail({ symbol: this.chainSymbol });
    this.chainId = chain.id;

    if (!this.isTxStreamAdapter(this.txStreamAdapter)) {
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
      arg &&
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
      arg &&
      (arg as IndexerService).process !== undefined &&
      (arg as IndexerService).createAction !== undefined
    );
  }
}
