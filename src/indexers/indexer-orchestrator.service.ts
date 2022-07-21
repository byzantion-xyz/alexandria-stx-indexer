import { Logger, Injectable, Provider, Inject } from "@nestjs/common";
import { BuyIndexerService } from "./common/providers/buy-indexer.service";
import { ListIndexerService } from "./common/providers/list-indexer.service";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { UnlistIndexerService } from "./common/providers/unlist-indexer.service";
import { Client } from "pg";
import { CommonTx } from "./common/interfaces/common-tx.interface";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Chain } from "src/database/universal/entities/Chain";
import { TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { IndexerService } from "./common/interfaces/indexer-service.interface";
import {
  IndexerOptions,
  IndexerSubscriptionOptions,
} from "./common/interfaces/indexer-options";

const BATCH_SIZE = 10000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class IndexerOrchestratorService {
  private chainSymbol: string;
  private readonly logger = new Logger(IndexerOrchestratorService.name);

  constructor(
    private buyIndexer: BuyIndexerService,
    private listIndexer: ListIndexerService,
    private unlistIndexer: UnlistIndexerService,
    private configService: ConfigService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Chain)
    private chainRepository: Repository<Chain>,
    @Inject('TxStreamAdapter') private txStreamAdapter: TxStreamAdapter,
  ) {}

  async runIndexer(options: IndexerOptions) {
    this.logger.debug(`runIndexer() Initialize `, options);
    try {
      await this.setUpChainAndStreamer();

      if (options.includeMissings) {
        let skip = 0;
        let txs: CommonTx[];
        do {
          this.logger.log(`Querying transactions skip:${skip} batch_size: ${BATCH_SIZE} `)
          txs = await this.txStreamAdapter.fetchMissingTxs(BATCH_SIZE, skip);
          this.logger.log(`Found ${txs.length} transactions`);
          await this.processTransactions(txs);
          skip += BATCH_SIZE;
        } while (txs.length >= BATCH_SIZE);
      } else {
        const txs: CommonTx[] = await this.txStreamAdapter.fetchTxs();
        await this.processTransactions(txs);
      }

      this.logger.debug(`runIndexer() Completed with options`, options);
      await delay(5000); // Wait for any discord post to be sent
    } catch (err) {
      this.logger.error(err);
    }
  }

  async subscribeToEvents(options: IndexerSubscriptionOptions) {
    this.logger.debug(`subscribeToEvents() Initialize `, options);

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

  async processTransactions(transactions: CommonTx[]) {
    for await (const tx of transactions) {
      const txResult: TxProcessResult = await this.processTransaction(tx);
      await this.txStreamAdapter.setTxResult(tx.hash, txResult);
    }
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
        if (smart_contract_function) {
          const txHandler = this.getMicroIndexer(smart_contract_function.name);
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
    const microIndexer = this[name + "Indexer"];
    if (!microIndexer || !this.isMicroIndexer(microIndexer)) {
      throw new Error(`No micro indexer defined for the context: ${name}`);
    }
    return microIndexer;
  }

  async setUpChainAndStreamer() {
    this.chainSymbol = this.configService.get("app.chainSymbol");
    if (!this.chainSymbol) {
      throw new Error(`CHAIN_SYMBOL must be provided as environment variable`);
    }

    const chain = await this.chainRepository.findOneByOrFail({
      symbol: this.chainSymbol,
    });
  
    if (
      !this.txStreamAdapter ||
      !this.isTxStreamAdapter(this.txStreamAdapter)
    ) {
      throw new Error(`No stream adapter defined for chain: ${this.chainSymbol}`);
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
