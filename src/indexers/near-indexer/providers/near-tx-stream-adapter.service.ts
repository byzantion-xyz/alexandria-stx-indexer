import { Injectable, Logger } from "@nestjs/common";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTxResult, TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
import * as moment from "moment";
import { Client, Pool } from 'pg';
import * as Cursor from 'pg-cursor';
import { NearTxHelperService } from "./near-tx-helper.service";
import { Transaction } from "../interfaces/near-transaction.dto";
import { ExecutionStatus, ExecutionStatusBasic } from "near-api-js/lib/providers/provider";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { IndexerEventType, SmartContractType } from "src/indexers/common/helpers/indexer-enums";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Transaction as TransactionEntity } from "src/database/near-stream/entities/Transaction";
import { ConfigService } from "@nestjs/config";

const WHITELISTED_ACTIONS = [
  'nft_approve', 
  'nft_revoke', 
  'nft_buy', 
  'buy', 
  'delete_market_data', 
  'unstake',
  'nft_transfer_call',
  'withdraw_nft'
];

@Injectable()
export class NearTxStreamAdapterService implements TxStreamAdapter {
  private readonly logger = new Logger(NearTxStreamAdapterService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private configService: ConfigService,
    @InjectRepository(TransactionEntity, "NEAR-STREAM")
    private transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(SmartContractFunction)
    private smartContractFunctionRepository: Repository<SmartContractFunction>
  ) {}

  async fetchTxs(contract_key?: string): Promise<any> {
    const sql = `select * from transaction t inner join receipt r on t.success_receipt_id=r.receipt_id 
      WHERE processed = false 
      AND missing = false
      AND
      (
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_approve"}}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_revoke"}}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_buy" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "buy" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "delete_market_data" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "unstake" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_transfer_call" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "withdraw_nft" }}]'
      )
      order by t.block_height ASC;
    `;

    const pool = new Pool({
      connectionString: this.configService.get('NEAR_STREAMER_SQL_DATABASE_URL')
    });
    const client = await pool.connect();

    const cursor = client.query(new Cursor(sql));
    return cursor;
  }

  async fetchMissingTxs(contract_key?: string): Promise<any> {
    let accounts_in = "";
    const accounts = await this.fetchAccounts();
    if (contract_key) {
      accounts_in = `'${contract_key}'`;
    } else {
      for (let i in accounts) {
        accounts_in += `'${accounts[i]}',`;
      }
      accounts_in = accounts_in.slice(0, -1);
    }

    const sql = `select * from transaction t inner join receipt r on t.success_receipt_id =r.receipt_id 
      WHERE receiver_id in (${accounts_in}) 
      AND processed = false 
      AND missing = true
      AND
      (
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_approve"}}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_revoke"}}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_buy" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "buy" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "delete_market_data" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "unstake" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "nft_transfer_call" }}]' OR
        transaction->'actions' @> '[{"FunctionCall": { "method_name": "withdraw_nft" }}]'
      )
      order by t.block_height ASC;
    `;

    const pool = new Pool({
      connectionString: this.configService.get('NEAR_STREAMER_SQL_DATABASE_URL')
    });
    const client = await pool.connect();

    const cursor = client.query(new Cursor(sql));
    return cursor;
  }

  async setTxResult(txHash: string, txResult: TxProcessResult): Promise<void> {
    if (txResult.processed || txResult.missing) {
      await this.transactionRepository.update(
        { hash: txHash },
        {
          processed: txResult.processed,
          missing: txResult.missing,
        }
      );
    }
  }

  async fetchAccounts(): Promise<string[]> {
    const smartContracts: SmartContract[] = await this.smartContractRepository.find({
      where: { chain: { symbol: "Near" } }
    });

    const accounts = smartContracts.map((sc) => sc.contract_key);

    return accounts;
  }

  // In case of nft_approve, there are diferrent market_type: ['sale', 'add_trade']
  // For nft_transfer_call, there are msg: stake and others
  findPreselectedIndexer(function_name: string, parsed_args: JSON): string {
    let force_indexer: string;
    if (function_name && parsed_args && parsed_args["msg"]) {
      // Map market_type on nft_approve to specific global function name
      if (function_name === "nft_approve") {
        const market_type = parsed_args["msg"]["market_type"];

        switch (market_type) {
          case "sale": force_indexer = "list";
            break;

          case "add_trade":
          case "accept_trade":
          case "accept_offer":
          case "accept_offer_paras_series":
          default: 
            force_indexer = 'unknown';
        }
      }
    }

    return force_indexer;
  }

  transformTx(tx: Transaction): CommonTx {
    try {
      let function_name = tx.transaction.actions[0].FunctionCall?.method_name;
      if (!WHITELISTED_ACTIONS.includes(function_name)) {
        return; // Do not process transaction
      }

      const args = tx.transaction.actions[0].FunctionCall?.args;
      let parsed_args;
      if (args) {
        parsed_args = this.nearTxHelper.parseBase64Arguments(args);
      }

      const notify =
        moment(
          new Date(this.txHelper.nanoToMiliSeconds(tx.block_timestamp))
        ).utc() > moment().subtract(2, "hours").utc()
          ? true
          : false;

      // Force indexer for special cases.
      let force_indexer = this.findPreselectedIndexer(function_name, parsed_args);
      if (force_indexer === 'unknown') return; // Do not process unkonwn transactions

      // TODO: Generate one transaction per tx.transaction.Action?
      return {
        hash: tx.transaction.hash,
        block_hash: tx.block_hash,
        block_timestamp: this.txHelper.nanoToMiliSeconds(tx.block_timestamp),
        block_height: tx.block_height,
        nonce: tx.transaction.nonce,
        signer: tx.transaction.signer_id,
        receiver: tx.transaction.receiver_id,
        function_name: function_name,
        args: parsed_args,
        notify,
        indexer_name: force_indexer
      };
    } catch (err) {
      this.logger.warn(`transormTx() has failed for tx hash: ${tx.hash}`);
      this.logger.warn(err);
    }
  }

  determineIfSuccessTx(status: ExecutionStatus | ExecutionStatusBasic): boolean {
    if (typeof (status as ExecutionStatus).SuccessReceiptId !== 'undefined' || 
      typeof (status as ExecutionStatus).SuccessValue !== 'undefined') {
      return true;
    } else {
      return false;
    }
  }

  transformTxs(txs: Transaction[]): CommonTx[] {
    let result: CommonTx[] = [];
    for (let tx of txs) {
      if (this.determineIfSuccessTx(tx.execution_outcome.outcome.status) && 
        this.determineIfSuccessTx(tx.outcome.execution_outcome.outcome.status)) {
        const transformed_tx = this.transformTx(tx);
        if (transformed_tx) result.push(transformed_tx);
      }
    }    
    return result;
  }

  subscribeToEvents(): Client {
    this.logger.log('subscribeToEvents() subscribe to listen new transactions');

    const client = new Client(this.configService.get('NEAR_STREAMER_SQL_DATABASE_URL'));
    client.connect();
  
    client.query('LISTEN new_receipt;', (err, res) => {
      this.logger.log('Listening DB transaction notifications');
    });

    return client;
  }

  async fetchEventData(event): Promise<CommonTx[]> {
    const sql = `select * from transaction t inner join receipt r on t.success_receipt_id =r.receipt_id 
      WHERE r.receipt_id ='${event}' 
      AND processed = false 
      AND missing = false;
    `;

    const txs: Transaction[] = await this.transactionRepository.query(sql);
    const result: CommonTx[] = this.transformTxs(txs);
  
    return result;
  }
}
