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
import { CommonUtilService } from 'src/common/helpers/common-util/common-util.service';

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
    private commonUtil: CommonUtilService,
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
    return txs.flatMap(tx => this.transformTx(tx))
  }

  transformTx(tx: StacksTransaction): CommonTx[] {
    try {  
      let commonTxs: CommonTx[] = [];
      commonTxs.push(this.transformTxBase(commonTxs.length, tx));
      
      const nftEvents = tx.tx.event_count ? this.stacksTxHelper.getNftEvents(tx) : [];

      if (nftEvents.length) {
        nftEvents.forEach(e => {
          commonTxs.push({
            function_name: 'nft_' + e.asset.asset_event_type + '_event',
            args: {
              ...e.asset,
              value: this.stacksTxHelper.parseHexData(e.asset.value.hex)
            },
            ... this.transformTxBase(commonTxs.length, tx)
          });
        });
      }
      
      return commonTxs;
    } catch (err) {
      this.logger.warn(`transormTx() has failed for tx hash: ${tx.hash}`);
    }
  }

  transformTxBase(i: number, tx: StacksTransaction) {
    const function_name = tx.tx.contract_call.function_name;

    const args = tx.tx.contract_call.function_args;
    let parsed_args;
    if (args) {
      parsed_args = this.stacksTxHelper.parseHexArguments(args);
    }

    const tx_index = BigInt(
      tx.tx.microblock_sequence.toString() + 
      this.commonUtil.padWithZeros(tx.tx.tx_index, 5) + 
      this.commonUtil.padWithZeros(i, 3)
    );

    return {
      hash: tx.hash,
      block_hash: tx.tx.block_hash,
      block_timestamp: tx.tx.burn_block_time * 1000,
      block_height: tx.block_height,
      nonce: BigInt(tx.tx.nonce),
      index: tx_index,
      signer: tx.tx.sender_address,
      receiver: tx.tx.contract_call.contract_id,
      function_name: function_name,
      args: parsed_args,
      events: tx.tx.events
    };
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
