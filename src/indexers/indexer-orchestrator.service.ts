import { Logger, Injectable, Provider, Inject } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { Client } from "pg";
import { CommonTx } from "./common/interfaces/common-tx.interface";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Chain } from "src/database/universal/entities/Chain";
import {
  CommonTxResult,
  ProcessedTxsResult,
  TxStreamAdapter,
} from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { IndexerService } from "./common/interfaces/indexer-service.interface";
import { IndexerOptions, IndexerSubscriptionOptions } from "./common/interfaces/indexer-options";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { CommonUtilService } from "src/common/helpers/common-util/common-util.service";
import { StacksMicroIndexers } from "./common/providers/stacks-micro-indexers.service";

const BATCH_SIZE = 1000;

@Injectable()
export class IndexerOrchestratorService {
  private chainSymbol: string;
  private genericScf: SmartContractFunction[] = [];
  private readonly logger = new Logger(IndexerOrchestratorService.name);
  private readonly MSG_NO_MICRO_INDEXER = "No micro indexer defined for the context";

  constructor(
    @Inject("StacksMicroIndexers") private stacksMicroIndexers: StacksMicroIndexers,
    private configService: ConfigService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Chain)
    private chainRepository: Repository<Chain>,
    @Inject("TxStreamAdapter") private txStreamAdapter: TxStreamAdapter,
    private commonUtil: CommonUtilService
  ) {}

  async runIndexer(options: IndexerOptions) {
    this.logger.debug(`runIndexer() Initialize with options: `, options);
    try {
      await this.setUpChainAndStreamer();
      if (options.includeMissings && !options.contract_key) {
        this.logger.warn("A contract_key is required while running missing transactions");
        return;
      }

      const { cursor, pool } = await this.txStreamAdapter.fetchTxs(options);

      let txs = [];
      this.logger.log(`Querying transactions cursor batch_size: ${BATCH_SIZE} `);
      do {
        txs = await cursor.read(BATCH_SIZE);
        this.logger.log(`Fetching next batch of transactions`);
        const common_txs: CommonTx[] = this.txStreamAdapter.transformTxs(txs);
        await this.processTransactions(common_txs);
      } while (txs.length > 0);

      cursor.close();
      pool.end();

      this.logger.debug(`runIndexer() Completed with options: `, options);
      await this.commonUtil.delay(5000); // Wait for any discord post to be sent
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
        this.logger.debug("subscribeToEvents() Current stream adapter does not support subscriptions");
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
      const smart_contract = await this.smartContractRepository.findOne({
        where: {
          contract_key: transaction.receiver,
          chain: { symbol: this.chainSymbol },
        },
        relations: {
          smart_contract_functions: true,
          custodial_smart_contract: true,
        },
        cache: 60000,
      });

      if (smart_contract) {
        let smart_contract_function = smart_contract.smart_contract_functions.find(
          (f) => f.function_name === method_name
        );

        if (!smart_contract_function && this.genericScf && this.genericScf.length) {
          smart_contract_function = this.genericScf.find((f) => f.function_name === method_name);
        }

        if (smart_contract_function) {
          const txHandler = this.getMicroIndexer(transaction.indexer_name || smart_contract_function.name);
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
      if (err.message.includes(this.MSG_NO_MICRO_INDEXER)) {
        this.logger.log(`Unable to process transaction with hash: ${transaction.hash}`);
        this.logger.log(this.MSG_NO_MICRO_INDEXER);
      } else {
        this.logger.error(`Error processing transaction with hash: ${transaction.hash}`);
        if (err.stack) this.logger.error(err.stack);
        else this.logger.error(err);
      }
    } finally {
      return result;
    }
  }

  getMicroIndexer(name: string) {
    const indexerName = this.commonUtil.toCamelCase(name) + "Indexer";
    let microIndexer;
    switch (this.chainSymbol) {
      case "Stacks":
        microIndexer = this.stacksMicroIndexers[indexerName];
        break;
    }
    if (!microIndexer || !this.isMicroIndexer(microIndexer)) {
      throw new Error(`${this.MSG_NO_MICRO_INDEXER}: ${name}`);
    }
    return microIndexer;
  }

  async setUpChainAndStreamer() {
    this.chainSymbol = this.configService.get("indexer.chainSymbol");
    if (!this.chainSymbol) {
      throw new Error(`CHAIN_SYMBOL must be provided as environment variable`);
    }
    const chain = await this.chainRepository.findOneByOrFail({ symbol: this.chainSymbol });

    if (!this.txStreamAdapter || !this.isTxStreamAdapter(this.txStreamAdapter)) {
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
    return typeof arg.fetchTxs === "function" && typeof arg.setTxResult === "function";
  }

  isTxStreamAdapterWithSubsriptions(arg): arg is TxStreamAdapter {
    return (
      this.isTxStreamAdapter(arg) &&
      typeof arg.subscribeToEvents === "function" &&
      typeof arg.fetchEventData === "function"
    );
  }

  isMicroIndexer(arg) {
    return (arg as IndexerService).process !== undefined && (arg as IndexerService).createAction !== undefined;
  }
}
