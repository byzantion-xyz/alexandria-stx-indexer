import { Injectable, Logger } from "@nestjs/common";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxResult, TxCursorBatch, TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
import { Client, Pool, PoolClient } from 'pg';
import * as Cursor from 'pg-cursor';
import { NearTxHelperService } from "./near-tx-helper.service";
import {FunctionCall, NftOrFtEvent, Receipt} from "../interfaces/near-indexer-tx-event.dto";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { IndexerTxEvent as TxEvent } from "src/database/near-stream/entities/IndexerTxEvent";
import { ConfigService } from "@nestjs/config";
import { IndexerOptions } from "src/indexers/common/interfaces/indexer-options";
import ExpiryMap = require('expiry-map');

export const NEAR_FT_STANDARD = 'nep141';
export const NEAR_FARMING_STANDARD = 'ref-farming';


@Injectable()
export class NearTxStreamAdapterService implements TxStreamAdapter {
  private poolClient: PoolClient;
  private pool: Pool;
  chainSymbol = 'Near';
  private readonly logger = new Logger(NearTxStreamAdapterService.name);

  private readonly txResults = new ExpiryMap(this.configService.get('indexer.txResultExpiration') || 60000);
  private txBatchResults: TxResult[] = [];

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private configService: ConfigService,
    @InjectRepository(TxEvent, "CHAIN-STREAM")
    private txEventRepository: Repository<TxEvent>,
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

  async fetchTxs(options: IndexerOptions): Promise<TxCursorBatch> {
    let contract_key: string;
    if (options.contract_key) {
      let sc = await this.smartContractRepository.findOne({
        where: {
          chain : { symbol: this.chainSymbol },
          contract_key: options.contract_key
        }
      });
      contract_key = sc ? sc.contract_key : undefined;
    }

    if (options.contract_key && !contract_key) {
      throw new Error(`Couldn't find matching smart contract: ${options.contract_key}`)
    }

    const sql = `select *
                 from indexer_tx_event_23092022
                 where block_height >= ${options.start_block_height ?? 0}
                    and block_height <= ${options.end_block_height ?? Number.MAX_SAFE_INTEGER}
                    ${contract_key ? `and receiver_id='${contract_key}'` : ''}
                    and processed = ${options.includeMissings}
                    and missing = ${options.includeMissings}
                 order by block_height asc`;

    const cursor = this.poolClient.query(new Cursor(sql));

    return { cursor };
  }

  setTxResult(tx: CommonTx, result: TxProcessResult): void {
    const txResult: [number, TxResult] = this.txResults.get(tx.hash);

    if (!txResult) {
      this.logger.warn(`Couldn't set TxProcessResult: ${tx.hash}`);
      return;
    }

    if (!result.processed) {
      txResult[1].processed = false;
    }

    if (tx.indexer_name?.endsWith('_event')) {
      txResult[1].missingNftEvent = txResult[1].missingNftEvent || result.missing;
    } else {
      txResult[1].matchingFunctionCall = txResult[1].matchingFunctionCall || !result.missing;
    }

    if (result.missing) {
      txResult[1].skipped.push(`${tx.function_name}:${tx.receipts[0].id}`);
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

    const sql = `update indexer_tx_event_23092022 as t set
        processed = v.processed,
        missing = v.missing,
        skipped = v.skipped
        from (values ${values.join(',')}) as v(hash, processed, missing, skipped) 
        where t.hash = v.hash`;

    this.logger.debug(`saveTxResults() txs: ${values.length}`);

    try {
      await this.txEventRepository.query(sql);
    } catch (err) {
      this.logger.warn('saveTxResults() failed');
      this.logger.error(err);
    }
  }

  async closePool(): Promise<any> {
    this.poolClient.release();

    await this.pool.end();
  }

  subscribeToEvents(): Client {
    const client = new Client(this.configService.get('NEAR_STREAMER_SQL_DATABASE_URL'));

    client.connect();

    client.query(`listen new_indexer_tx_event_23092022`, (err, res) => {
      if (err != null) {
        this.logger.error('Failed to subscribe to `new_indexer_tx_event_23092022` notifications', err);
      } else {
        this.logger.log('Successfully subscribed to `new_indexer_tx_event_23092022` notifications');
      }
    });

    return client;
  }

  async fetchEventData(event): Promise<CommonTx[]> {
    const sql = `select *
                 from indexer_tx_event_23092022
                 where hash = '${ event }'
                   and processed = false
                   and missing = false`;

    return this.transformTxs(await this.txEventRepository.query(sql));
  }

  transformTxs(txs: TxEvent[]): CommonTx[] {
    return txs.flatMap(tx => this.transformTx(tx))
  }

  transformTx(tx: TxEvent): CommonTx[] {
    const commonTxs: CommonTx[] = [];
    let containsFunctionCallCommonTx = false;

    this.nearTxHelper.getReceiptTree(tx).forEach((rcpt) => {
      const events = (tx.contains_event)
          ? this.nearTxHelper.getEvents(rcpt) : [];

      if (events.length
          && events.every(([e, _]) => e.standard === NEAR_FT_STANDARD ||  e.standard === NEAR_FARMING_STANDARD)) {
        return commonTxs;
      }

      // https://nearblocks.io/txns/FiMZPjsEM6hWsN6eQKXC76NLtcjYsKtjtuV1QxhmSJy1#execution
      if (this.nearTxHelper.getLogs(rcpt).some((l) => l.includes('Insufficient storage paid'))) {
        return commonTxs;
      }

      if (!events.length || !events.every(([e, _]) => e.event === 'nft_mint' || e.event === 'nft_burn')) {
        let receipts = [rcpt].concat(this.nearTxHelper.flatMapReceipts(rcpt.receipts));

        receipts.filter(r => r.status === 'succeeded').forEach(r => {
          r.function_calls.forEach((fc) => {
            const indexer = this.defineFunctionCallIndexer(fc, r, events);

            if (indexer) {
              commonTxs.push({
                function_name: fc.method_name,
                indexer_name: (indexer !== 'def') ? indexer : null,
                args: fc.args,
                ...this.transformTxBase(commonTxs.length, r, tx)
              });
              containsFunctionCallCommonTx = true;
            }
          });
        });
      }

      events.forEach(([e, r]) => {
        commonTxs.push({
          function_name: e.event + '_event',
          indexer_name: e.event + '_event',
          args: e.data,
          ...this.transformTxBase(commonTxs.length, r, tx)
        });
      });
    });

    if (commonTxs.length) {
      this.txResults.set(tx.hash, [commonTxs.length, {
        hash : tx.hash,
        processed: true,
        missingNftEvent: false,
        matchingFunctionCall: !containsFunctionCallCommonTx,
        skipped: []
      } as TxResult]);
    }

    return commonTxs;
  }

  private defineFunctionCallIndexer(fc: FunctionCall, rcpt: Receipt,  events: [NftOrFtEvent, Receipt][]) : string {
    switch (fc.method_name) {
      case 'nft_approve' : {
        // https://nearblocks.io/txns/Efcw51xC9xxYj3fBq9UhmNgmfCNdETHjPga9vkS8ULLy#execution
        if (!fc.args['msg']?.['is_auction']) {
          switch (fc.args['msg']?.['market_type']) {
            case 'accept_offer': {
              return 'accept_bid';
            }
            case 'sale': {
              return 'list';
            }
            case 'accept_offer_paras_series': {
              return 'accept_bid';
            }
          }
        }

        // https://nearblocks.io/en/txns/EZrwG2ABowDgiHwthJNGi4Ep3keXqJcDTo3FP6BD4Eq6#execution
        if (fc.args['msg']?.['sale_conditions']?.['near']) {
          return 'list';
        }

        // https://nearblocks.io/txns/CeZJdjf3Uzk6hMevABugTg5D2EgCbgeVyP7KbLTzFamd#execution
        if (fc.args['msg']?.['staking_status']) {
          return 'stake';
        }

        break;
      }
      case 'nft_transfer': {
        return 'def';
      }
      case 'offer' : {
        if (events.some(([e, _]) => e.event === 'nft_transfer')) {
          return 'buy';
        } else {
          // https://nearblocks.io/txns/FHK3AAsq1FAgFuUW7tJZdfQMSzLHVetDZssY6PUu1M2G#execution 
          return 'fewandfar-bid';
        }
      }
      case 'add_offer': {
        // https://nearblocks.io/txns/C8F5zhHjN2NvKf3RJGhhKzuoqT5urduLHz3B9tSqS6n5#
         if (fc.args['token_series_id']) {
          return 'collection_bid';
        }

        if (fc.args['token_id']) {
          return 'bid';
        }
      }
      case 'delete_offer': {
        // https://nearblocks.io/txns/CapxSDLQ1xrSKvGUHeZRBLdXfq2rot5dS8PTR1hm7JMH#
        if (fc.args['token_series_id']) {
          return 'collection_unlist_bid';
        }

        // https://explorer.near.org/transactions/J2pZWuL16zTQ1uLDuCwKigcdKdqEQafyxJ66hsRMYdH6
        if (fc.args['token_id']) {
          return 'unlist_bid';
        }
      }
     
      default: {
        return 'def';
      }
    }

    this.logger.warn(`Couldn't define '${fc.method_name}' function call micro indexer: ${rcpt.id}`);

    return null;
  }

  private transformTxBase(i: number, rctp: Receipt, tx: TxEvent) {
    return {
      hash : tx.hash,
      block_hash: tx.block_hash,
      block_timestamp: this.txHelper.nanoToMiliSeconds(tx.block_timestamp),
      block_height: tx.block_height,
      nonce: tx.nonce,
      index: BigInt(i),
      signer: rctp.signer_id,
      receiver: rctp.receiver_id,
      receipts: [rctp]
    }
  }
}