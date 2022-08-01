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
import {
  IndexerOptions,
  IndexerSubscriptionOptions,
} from "./common/interfaces/indexer-options";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { CommonUtilService } from "src/common/helpers/common-util/common-util.service";
import { NearMicroIndexers } from "./common/providers/near-micro-indexers.service";
import { StacksMicroIndexers } from "./common/providers/stacks-micro-indexers.service";
import { MissingCollectionService } from "src/scrapers/near-scraper/providers/missing-collection.service";

const BATCH_SIZE = 1000;

@Injectable()
export class IndexerOrchestratorService {
  private chainSymbol: string;
  private genericScf: SmartContractFunction[] = [];
  private readonly logger = new Logger(IndexerOrchestratorService.name);

  constructor(
    @Inject('NearMicroIndexers') private nearMicroIndexers: NearMicroIndexers,
    @Inject('StacksMicroIndexers') private stacksMicroIndexers: StacksMicroIndexers,
    private configService: ConfigService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Chain)
    private chainRepository: Repository<Chain>,
    @Inject('TxStreamAdapter') private txStreamAdapter: TxStreamAdapter,
    private commonUtil: CommonUtilService,
    private missingCollectionService: MissingCollectionService,
  ) {}

  async runIndexer(options: IndexerOptions) {
    this.logger.debug(`runIndexer() Initialize with options includeMissings:${options.includeMissings}`);
    try {
      await this.setUpChainAndStreamer();

      const cursor = options.includeMissings
      ? await this.txStreamAdapter.fetchMissingTxs(options.contract_key)
      : await this.txStreamAdapter.fetchTxs(options.contract_key);

      let txs = [];
      do {
        this.logger.log(`Querying transactions cursor batch_size: ${BATCH_SIZE} `);
        txs = await cursor.read(BATCH_SIZE);
        this.logger.log(`Found ${txs.length} transactions`);
        const common_txs: CommonTx[] = this.txStreamAdapter.transformTxs(txs);
        await this.processTransactions(common_txs);
      } while (txs.length > 0);
      
      cursor.close();

      this.logger.debug(`runIndexer() Completed with options includeMissings:${options.includeMissings}`);
      await this.commonUtil.delay(5000); // Wait for any discord post to be sent
    } catch (err) {
      this.logger.error(err);
    }
  }

  async subscribeToEvents(options: IndexerSubscriptionOptions) {
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
        this.logger.debug('subscribeeToEvents() Current stream adapter does not support subscriptions');
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
      await this.txStreamAdapter.setTxResult(tx.hash, txResult);
    }

    return { total: processed };
  }

  async processTransaction(transaction: CommonTx): Promise<TxProcessResult> {
    let result: TxProcessResult = { processed: false, missing: false };

    try {
      const method_name = transaction.function_name;
      const finder = {
        where: { contract_key: transaction.receiver, chain: { symbol: this.chainSymbol } },
        relations: { smart_contract_functions: true },
      };
      const smart_contract = await this.smartContractRepository.findOne(finder);

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
          result = await txHandler.process(
            transaction,
            smart_contract,
            smart_contract_function
          );
        } else {
          this.logger.log(
            `function_name: ${method_name} not found in ${transaction.receiver}`
          );
          result.missing = true;
        }
      } else {
        this.logger.log(`smart_contract: ${transaction.receiver} not found`);
        this.missingCollectionService.scrapeMissing({ contract_key: transaction.receiver });

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
    const indexerName = this.commonUtil.toCamelCase(name) + "Indexer";
    let microIndexer;
    switch (this.chainSymbol) {
      case "Near": microIndexer = this.nearMicroIndexers[indexerName];
        break;
      case "Stacks": microIndexer = this.stacksMicroIndexers[indexerName];
        break;
    }
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
      typeof arg.fetchMissingTxs === 'function' &&
      typeof arg.fetchTxs === 'function' &&
      typeof arg.setTxResult === 'function'
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
