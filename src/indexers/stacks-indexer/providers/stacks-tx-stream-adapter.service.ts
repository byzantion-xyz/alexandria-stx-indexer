import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client, Pool, PoolClient } from 'pg';
import * as Cursor from 'pg-cursor';

import { Transaction as TransactionEntity } from 'src/database/stacks-stream/entities/Transaction';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxCursorBatch, TxResult, TxStreamAdapter } from 'src/indexers/common/interfaces/tx-stream-adapter.interface';
import { Repository } from 'typeorm';
import { StacksTransaction } from '../dto/stacks-transaction.dto';
import { StacksTxHelperService } from './stacks-tx-helper.service';
import { IndexerOptions } from 'src/indexers/common/interfaces/indexer-options';
import { CommonUtilService } from 'src/common/helpers/common-util/common-util.service';
import ExpiryMap = require('expiry-map');

const EXCLUDED_SMART_CONTRACTS = [
  'SP000000000000000000002Q6VF78.bns',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace-v1',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace-v3'
];

@Injectable()
export class StacksTxStreamAdapterService implements TxStreamAdapter {
  readonly chainSymbol = 'Stacks';

  private poolClient: PoolClient;
  private pool: Pool;
  private readonly logger = new Logger(StacksTxStreamAdapterService.name);

  private txBatchResults: TxResult[] = [];
  private readonly txResults = new ExpiryMap(this.configService.get('indexer.txResultExpiration') || 60000);

  constructor (
    private configService: ConfigService,
    private stacksTxHelper: StacksTxHelperService,
    private commonUtil: CommonUtilService,
    @InjectRepository(TransactionEntity, "CHAIN-STREAM")
    private transactionRepository: Repository<TransactionEntity>
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
    const end_block_height = this.configService.get('indexer.blockRanges.Stacks.end_block_height') || 0;    

    const sql = `SELECT * FROM transaction t
      WHERE block_height >= ${options.start_block_height ?? 0}
      AND block_height <= ${options.end_block_height ?? end_block_height}
      AND contract_id NOT IN (${EXCLUDED_SMART_CONTRACTS.map((key) => `'${key}'`).join(',')})
      AND tx->>'tx_type' = 'contract_call'
      AND tx->>'tx_status' = 'success'
      AND processed = false
      AND missing = ${ options.includeMissings ? true : false }
      ORDER BY t.block_height ASC, tx->>'microblock_sequence' ASC, tx->>'tx_index' ASC
    `;

    const cursor = this.poolClient.query(new Cursor(sql));
    return { cursor };
  }

  setTxResult(tx: CommonTx, result: TxProcessResult): void {
    const txResult: [number, TxResult] = this.txResults.get(tx.hash);

    if (!txResult) {
      this.logger.warn(`Couldn't set TxProcessResult: ${tx.hash}`);
      return;
    }

    const isNftEvent = tx.function_name?.endsWith('_event');

    if (!result.processed && !result.missing) {
      txResult[1].processed = false;
    }

    if (isNftEvent) {
      txResult[1].missingNftEvent = txResult[1].missingNftEvent || result.missing;
    } else {
      txResult[1].matchingFunctionCall = txResult[1].matchingFunctionCall || !result.missing;
    }

    if (result.missing) {
      txResult[1].skipped.push(`${tx.function_name}${isNftEvent ? ':' + tx.args.event_index : ''}`);
    }

    if (txResult[0] <= 1) {
      this.txResults.delete(tx.hash);

      this.txBatchResults.push(txResult[1]);
    } else {
      this.txResults.set(tx.hash, [txResult[0] - 1, txResult[1]]);
    }
  }

  async saveTxResults(): Promise<void> {
    const values = this.txBatchResults.map((res) => {
      const skipped = `'{${res.skipped.join(',')}}'::text[]`;
      return `('${res.hash}', ${res.processed}, ${res.missingNftEvent || !res.matchingFunctionCall}, ${skipped})`;
    });

    this.txBatchResults = [];

    const sql = `update transaction as t set
        processed = v.processed,
        missing = v.missing,
        skipped = v.skipped
        from (values ${values.join(',')}) as v(hash, processed, missing, skipped) 
        where t.hash = v.hash`;

    this.logger.debug(`saveTxResults() txs: ${values.length}`);

    try {
      await this.transactionRepository.query(sql);
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
      const args = tx.tx.contract_call.function_args;
      let parsed_args;
      if (args) {
        parsed_args = this.stacksTxHelper.parseHexArguments(args);
      }

      commonTxs.push({
        function_name: tx.tx.contract_call.function_name,
        args: parsed_args,
        ...this.transformTxBase(commonTxs.length, tx)
      });
      
      const nftEvents = tx.tx.event_count ? this.stacksTxHelper.getNftEvents(tx) : [];

      if (nftEvents.length) {
        nftEvents.forEach(e => {
          commonTxs.push({
            function_name: 'nft_' + e.asset.asset_event_type + '_event',
            args: {
              event_index: e.event_index
            },
            ... this.transformTxBase(commonTxs.length, tx),
          });
        });
      }

      if (commonTxs.length) {
        this.txResults.set(tx.hash, [commonTxs.length, {
          hash : tx.hash,
          processed: true,
          missingNftEvent: false,
          matchingFunctionCall: true,
          skipped: []
        } as TxResult]);
      }

      return commonTxs;
    } catch (err) {
      this.logger.warn(`transormTx() has failed for tx hash: ${tx.hash}`);
    }
  }

  transformTxBase(i: number, tx: StacksTransaction) {
    const tx_index = BigInt(
      tx.tx.microblock_sequence.toString() + 
      this.commonUtil.padWithZeros(tx.tx.tx_index, 5) + 
      this.commonUtil.padWithZeros(i, 4)
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
}
