import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client, Pool, PoolClient } from 'pg';
import * as Cursor from 'pg-cursor';

import { Transaction as TransactionEntity } from 'src/database/stacks-stream/entities/Transaction';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { StacksTxBatchResult, TxCursorBatch, TxStreamAdapter } from 'src/indexers/common/interfaces/tx-stream-adapter.interface';
import { In, Not, Repository } from 'typeorm';
import { StacksTransaction } from '../dto/stacks-transaction.dto';
import { StacksTxHelperService } from './stacks-tx-helper.service';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { IndexerOptions } from 'src/indexers/common/interfaces/indexer-options';

const EXCLUDED_ACTIONS = ['add-collection', 'add-contract'];

@Injectable()
export class StacksTxStreamAdapterService implements TxStreamAdapter {
  private poolClient: PoolClient;
  private pool: Pool;
  private txBatchResults: StacksTxBatchResult[] = [];
  private readonly logger = new Logger(StacksTxStreamAdapterService.name);
  chainSymbol = 'Stacks';

  constructor (
    private configService: ConfigService,
    private stacksTxHelper: StacksTxHelperService,
    @InjectRepository(TransactionEntity, "CHAIN-STREAM")
    private transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async connectPool(): Promise<any> {
    this.pool = new Pool({
      connectionString: this.configService.get('STACKS_STREAMER_SQL_DATABASE_URL')
    });
    this.poolClient = await this.pool.connect();
  }

  async closePool(): Promise<any> {
    this.poolClient.release();
    await this.pool.end();
  }

  async fetchTxs(options: IndexerOptions): Promise<TxCursorBatch> {
    const contracts = await this.findSmartContracts(options.contract_key);

    const sql = `SELECT * from transaction t
      WHERE t.contract_id IN (${contracts.map((c) => `'${c.contract_key}'`).join(',')})
      ${ options.start_block_height ? 'AND t.block_height >=' + options.start_block_height : '' }
      ${ options.end_block_height ? 'AND t.block_height <='+ options.end_block_height  : '' }
      AND tx->>'tx_type' = 'contract_call'
      AND tx->>'tx_status' = 'success'
      AND processed = false
      AND missing = ${ options.includeMissings ? true : false }
      ORDER BY t.block_height ASC, tx->>'microblock_sequence' asc, tx->>'tx_index' ASC 
    `;

    const cursor = this.poolClient.query(new Cursor(sql));
    return { cursor };
  }

  async setTxResult(tx: CommonTx, txResult: TxProcessResult): Promise<void> {
    if (txResult.processed || txResult.missing) {
      this.txBatchResults.push({
        hash: tx.hash,
        processed: txResult.processed,
        missing: txResult.missing
      });
    }
  }

  async saveTxResults(): Promise<void> {
    try {
      const values = this.txBatchResults.map(rowValue => `('${rowValue.hash}', ${rowValue.processed}, ${rowValue.missing})`);

      const sql = `update transaction as t set
          processed = c.processed,
          missing = c.missing
          from (values ${values.join(',')}) as c(hash, processed, missing) 
          where t.hash = c.hash;`;

      this.logger.debug(`saveTxResults() txs: ${this.txBatchResults.length}`);
      this.txBatchResults = [];
      if (values.length) {
        await this.transactionRepository.query(sql);
      }
    } catch (err) {
      this.logger.warn('saveTxResults() failed');
      this.logger.error(err);
    } 
  }

  transformTxs(txs: StacksTransaction[]): CommonTx[] {
    let result: CommonTx[] = [];

    for (let tx of txs) {
      const transformed_tx = this.transformTx(tx);
      if (transformed_tx) result.push(transformed_tx);
    }

    return result;
  }

  transformTx(tx: StacksTransaction): CommonTx {
    try {
      const function_name = tx.tx.contract_call.function_name;
      if (EXCLUDED_ACTIONS.includes(function_name)) {
        return; // Do not process transaction
      }

      const args = tx.tx.contract_call.function_args;
      let parsed_args;
      if (args) {
        parsed_args = this.stacksTxHelper.parseHexArguments(args);
      }

      return {
        hash: tx.hash,
        block_hash: tx.tx.block_hash,
        block_timestamp: tx.tx.burn_block_time * 1000,
        block_height: tx.block_height,
        nonce: BigInt(tx.tx.nonce),
        index: BigInt(tx.tx.tx_index),
        sub_block_sequence: BigInt(tx.tx.microblock_sequence),
        signer: tx.tx.sender_address,
        receiver: tx.tx.contract_call.contract_id,
        function_name: function_name,
        args: parsed_args,
        events: tx.tx.events
      };
    } catch (err) {
      this.logger.warn(`transormTx() has failed for tx hash: ${tx.hash}`);
    }
  }

  subscribeToEvents(): Client {
    this.logger.log('subscribeToEvents() subscribe to listen new blocks');

    const client = new Client(this.configService.get('STACKS_STREAMER_SQL_DATABASE_URL'));
    client.connect();

    client.query('LISTEN new_block;', (err, res) => {
      this.logger.log('Listening DB block notifications');
    });

    return client;
  }

  async fetchEventData(event): Promise<CommonTx[]> {
    const sql = `SELECT * from transaction t
      WHERE block_height=${event} 
      AND tx->>'tx_type' = 'contract_call' 
      AND tx->>'tx_status' = 'success' 
      AND processed = false 
      AND missing = false
      ORDER BY tx->>'microblock_sequence' asc, tx->>'tx_index' ASC;
    `;

    const txs: StacksTransaction[] = await this.transactionRepository.query(sql);
    const result: CommonTx[] = this.transformTxs(txs);

    return result;
  }

  private async findSmartContracts(contract_key?: string): Promise<SmartContract[]> {
    // Bns marketplaces excluded until micro indexers are fully implemented.
    let accounts = await this.smartContractRepository.find({
      where: {
        chain : { symbol: this.chainSymbol },
        ...( contract_key
          ? { contract_key }
          : { contract_key: Not(In([
            'SP000000000000000000002Q6VF78.bns',
            'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace',
            'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace-v1',
            'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace-v3'
          ])) }
        )
      },
      select: { contract_key: true }
    });
    if (!accounts || !accounts.length) throw new Error('Invalid contract_key');

    return accounts;
  }
}
