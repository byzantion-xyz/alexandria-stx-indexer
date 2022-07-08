import { Logger, Injectable, Provider } from "@nestjs/common";
import { BuyIndexerService } from "./common/providers/buy-indexer.service";
import { ListIndexerService } from "./common/providers/list-indexer.service";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { UnlistIndexerService } from "./common/providers/unlist-indexer.service";
import { Client } from "pg";
import { NearTxStreamAdapterService } from "./near-indexer/providers/near-tx-stream-adapter.service";
import { CommonTx } from "./common/interfaces/common-tx.interface";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StacksTxStreamAdapterService } from "./stacks-indexer/providers/stacks-tx-stream-adapter.service";
import { ConfigService } from "@nestjs/config";
import { Chain } from "src/database/universal/entities/Chain";
import { TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { IndexerService } from "./common/interfaces/indexer-service.interface";
import {
  IndexerOptions,
  IndexerSubscriptionOptions,
} from "./common/interfaces/indexer-options";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class IndexerOrchestratorService {
  private txStreamAdapter: TxStreamAdapter;
  private readonly logger = new Logger(IndexerOrchestratorService.name);

  constructor(
    private nearTxStreamAdapter: NearTxStreamAdapterService,
    private stacksTxStreamAdapter: StacksTxStreamAdapterService,
    private buyIndexer: BuyIndexerService,
    private listIndexer: ListIndexerService,
    private unlistIndexer: UnlistIndexerService,
    private configService: ConfigService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Chain)
    private chainRepository: Repository<Chain>
  ) {}

  async runIndexer(options: IndexerOptions) {
    this.logger.debug(`runIndexer() Initialize `, options);
    try {
      await this.setUpChainAndStreamer();

      const txs: CommonTx[] = options.includeMissings ? await this.txStreamAdapter.fetchMissingTxs()
        : await this.txStreamAdapter.fetchTxs();
      await this.processTransactions(txs);

      this.logger.debug(`runIndexer() Completed with options ${options}`);
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
          this.logger.log(event);
          const txs: CommonTx[] = await this.txStreamAdapter.fetchEventData(event, options.event);
          
          await this.processTransactions(txs);
  
          this.logger.debug(`subscribeToEvents() Processed event ${event}`);
          await delay(5000); // Wait for any discord post to be sent
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
      await this.nearTxStreamAdapter.setTxResult(tx.hash, txResult);
    }
  }

  async processTransaction(transaction: CommonTx): Promise<TxProcessResult> {
    let result: TxProcessResult = { processed: false, missing: false };

    try {
      const method_name = transaction.function_name;
      const finder = {
        where: { contract_key: transaction.receiver },
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
      throw new Error(`No service defined for the context: ${name}`);
    }
    return microIndexer;
  }

  async setUpChainAndStreamer() {
    const chain_symbol: string = this.configService.get("app.chainSymbol");
    if (!chain_symbol) {
      throw new Error(`CHAIN_SYMBOL must be provided as environment variable`);
    }

    const chain = await this.chainRepository.findOneByOrFail({
      symbol: chain_symbol,
    });
    this.txStreamAdapter = this[chain.symbol.toLowerCase() + "TxStreamAdapter"];
    if (
      !this.txStreamAdapter ||
      !this.isTxStreamAdapter(this.txStreamAdapter)
    ) {
      throw new Error(`No stream adapter defined for chain: ${chain_symbol}`);
    }
  }

  isTxStreamAdapter(arg) {
    return (
      (arg as TxStreamAdapter).fetchMissingTxs !== undefined &&
      (arg as TxStreamAdapter).fetchTxs !== undefined &&
      (arg as TxStreamAdapter).setTxResult !== undefined
    );
  }

  isTxStreamAdapterWithSubsriptions(arg) {
    return (this.isTxStreamAdapter(arg) &&
      (arg as TxStreamAdapter).subscribeToEvents !== undefined &&
      (arg as TxStreamAdapter).fetchEventData !== undefined
    );
  }

  isMicroIndexer(arg) {
    return (
      (arg as IndexerService).process !== undefined &&
      (arg as IndexerService).createAction !== undefined
    );
  }
}
