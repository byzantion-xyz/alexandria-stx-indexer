import { Injectable, Logger } from "@nestjs/common";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxCursorBatch, TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
import * as moment from "moment";
import { Client, Pool, PoolClient } from 'pg';
import * as Cursor from 'pg-cursor';
import { NearTxHelperService } from "./near-tx-helper.service";
import { FunctionCallEvent } from "../interfaces/near-function-call-event.dto";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { FunctionCallEvent as FunctionCallEventEntity } from "src/database/near-stream/entities/FunctionCallEvent";
import { ConfigService } from "@nestjs/config";
import { IndexerOptions } from "src/indexers/common/interfaces/indexer-options";

@Injectable()
export class NearTxStreamAdapterService implements TxStreamAdapter {
  private poolClient: PoolClient;
  private pool: Pool;
  chainSymbol = 'Near';
  private readonly logger = new Logger(NearTxStreamAdapterService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private configService: ConfigService,
    @InjectRepository(FunctionCallEventEntity, "CHAIN-STREAM")
    private functionCallEventRepository: Repository<FunctionCallEventEntity>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(SmartContractFunction)
    private smartContractFunctionRepository: Repository<SmartContractFunction>
  ) {}

  async connectPool(): Promise<any> {
    this.pool = new Pool({
      connectionString: this.configService.get('NEAR_STREAMER_SQL_DATABASE_URL')
    });
    this.poolClient = await this.pool.connect();
  }

  async closePool(): Promise<any> {
    this.poolClient.release();
    await this.pool.end();
  }

  async fetchTxs(options: IndexerOptions): Promise<TxCursorBatch> {
    const accounts = await this.findSmartContracts(options.contract_key);
    let accounts_in = this.buildReceiverIdInQuery(accounts);

    const sql = `select * from function_call_event where receiver_id in (${accounts_in})
      ${ options.start_block_height ? 'and executed_block_height >=' + options.start_block_height : '' }
      ${ options.end_block_height ? 'and executed_block_height <'+ options.end_block_height  : '' }
      and processed = false
      and missing = ${ options.includeMissings }                                  
      order by executed_block_height asc;
    `;

    const cursor = this.poolClient.query(new Cursor(sql));
    return { cursor };
  }

  async setTxResult(txHash: string, txResult: TxProcessResult): Promise<void> {
    if (txResult.processed || txResult.missing) {
       await this.functionCallEventRepository.update({ originating_receipt_id: txHash },
           {
             processed: txResult.processed,
             missing: txResult.missing,
           }
       );
     }
  }

  // In case of nft_approve, there are diferrent market_types: ['sale', 'add_trade']
  // For nft_transfer_call, there are msg: stake and others
  // fewandfar provides sale_conditions
  // apollo42 and paras provide market_type
  findPreselectedIndexer(tx: FunctionCallEvent, function_name: string, parsed_args: JSON): string {
    let force_indexer: string;
    if (!function_name || !parsed_args) force_indexer = 'unknown';

    // Map market_type on nft_approve to specific global function name
    if (function_name === "nft_approve" && parsed_args["msg"]) {
      const market_type = parsed_args["msg"]["market_type"];
      const sale_conditions = parsed_args["msg"]["sale_conditions"];
      const staking_status = parsed_args["msg"]["staking_status"];
      const is_auction = parsed_args["msg"]["is_auction"];

      if (market_type && !is_auction) {
        switch (market_type) {
          case "sale": force_indexer = "list";
            break;

          case "accept_offer": force_indexer = "accept_bid";
            break;

          default:
            this.logger.warn(`Unable to find a micro indexer for ${function_name} "${market_type}"`);
            force_indexer = 'unknown'; // Not implemented
        }
      } else if (sale_conditions && sale_conditions.near && !isNaN(sale_conditions.near)) {
        // Few and Far listing with near token
        force_indexer = 'list';
      } else if (sale_conditions) {
        force_indexer = 'unknown';
        this.logger.warn(`Unable to find a micro indexer for ${function_name} ` +
        ` originating receipt: ${tx.originating_receipt_id} sale_conditions`, sale_conditions);
      } else if (staking_status) {
        force_indexer = 'stake';
      } else {
        force_indexer = 'unknown';
        this.logger.warn(`Unable to find a micro indexer for ${function_name} originating receipt: ${tx.originating_receipt_id}`);
      }
    }

    return force_indexer;
  }

  transformTx(tx: FunctionCallEvent): CommonTx {
    try {
      const parsed_args = this.nearTxHelper.parseBase64Arguments(tx.args, tx.originating_receipt_id);

      // Force indexer for special cases.
      let force_indexer = this.findPreselectedIndexer(tx, tx.method, parsed_args);
      if (force_indexer === 'unknown') {
        return; // Do not process unkonwn transactions
      }

      return {
        hash: tx.originating_receipt_id,
        block_hash: tx.executed_block_hash,
        block_timestamp: this.txHelper.nanoToMiliSeconds(tx.executed_block_timestamp),
        block_height: tx.executed_block_height,
        signer: tx.signer_id,
        receiver: tx.receiver_id,
        function_name: tx.method,
        args: parsed_args,
        indexer_name: force_indexer
      };
    } catch (err) {
      this.logger.warn(`transormTx() has failed for tx originating_receipt_id: ${tx.originating_receipt_id}`);
      this.logger.warn(err);
    }
  }

  transformTxs(txs: FunctionCallEvent[]): CommonTx[] {
    let result: CommonTx[] = [];

    for (let tx of txs) {
      const transformed_tx = this.transformTx(tx);
      if (transformed_tx) {
        result.push(transformed_tx);
      }
    }

    return result;
  }

  subscribeToEvents(): Client {
    this.logger.log('subscribeToEvents() subscribe to listen new function call events');

    const client = new Client(this.configService.get('NEAR_STREAMER_SQL_DATABASE_URL'));
    client.connect();

    client.query('LISTEN new_function_call_event;', (err, res) => {
      this.logger.log('Listening DB `function_call_event` notifications');
    });

    return client;
  }

  async fetchEventData(event): Promise<CommonTx[]> {
    const sql = `select * from function_call_event 
         where originating_receipt_id= '${event}' and processed = false and missing = false`;

    const fc_events: FunctionCallEvent[] = await this.functionCallEventRepository.query(sql);
    const result: CommonTx[] = this.transformTxs(fc_events);

    return result;
  }

  private buildReceiverIdInQuery(scs: SmartContract[]): string {
    let accounts_in = '';
    const accounts = scs.map((sc) => sc.contract_key);
    for (let i in accounts) {
      accounts_in += `'${accounts[i]}',`;
    }
    accounts_in = accounts_in.slice(0, -1);

    return accounts_in;
  }

  private async findSmartContracts(contract_key?: string): Promise<SmartContract[]> {
    let accounts = await this.smartContractRepository.find({
      where: {
        chain : { symbol: this.chainSymbol },
        ...( contract_key && { contract_key })
      }
    });
    if (!accounts || !accounts.length) throw new Error('Invalid contract_key');

    return accounts;
  }
}
