import { Injectable, Logger } from "@nestjs/common";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxCursorBatch, TxStreamAdapter } from "src/indexers/common/interfaces/tx-stream-adapter.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
import { Client, Pool, PoolClient } from 'pg';
import * as Cursor from 'pg-cursor';
import { NearTxHelperService } from "./near-tx-helper.service";
import {FunctionCall, NftEvent, Receipt} from "../interfaces/near-indexer-tx-event.dto";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { IndexerTxEvent as TxEvent } from "src/database/near-stream/entities/IndexerTxEvent";
import { ConfigService } from "@nestjs/config";
import { IndexerOptions } from "src/indexers/common/interfaces/indexer-options";
import ExpiryMap = require('expiry-map');

@Injectable()
export class NearTxStreamAdapterService implements TxStreamAdapter {
  private poolClient: PoolClient;
  private pool: Pool;
  chainSymbol = 'Near';
  private readonly logger = new Logger(NearTxStreamAdapterService.name);

  private readonly txResults = new ExpiryMap(30000);

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
    const contracts = await this.smartContractRepository.find({
      where: {
        chain : { symbol: this.chainSymbol },
        ...( options.contract_key && { contract_key: options.contract_key })
      }
    });

    if (!contracts || !contracts.length) {
      throw new Error(`Couldn't find matching smart contracts: ${options}`)
    }

    const sql = `select *
                 from indexer_tx_event
                 where receiver_id in (${contracts.map((c) => `'${c.contract_key}'`).join(',')})
                    and block_height >= ${options.start_block_height ?? 0}
                    and block_height <= ${options.end_block_height ?? Number.MAX_SAFE_INTEGER}
                    and processed = false
                    and missing = ${options.includeMissings}                                  
                 order by block_height asc`;

    const cursor = this.poolClient.query(new Cursor(sql));

    return { cursor };
  }

  async setTxResult(hash: string, result: TxProcessResult): Promise<void> {
    const txResult: [number, boolean] = this.txResults.get(hash);

    if (!txResult) {
      throw new Error(`Couldn't set TxProcessResult: ${hash}`)
    }

    if (txResult[0] <= 1) {
      this.txResults.delete(hash);

      // TODO: Uncomment this when ready
      // await this.txEventRepository.update({ hash: hash },
      //     {
      //       processed: true,
      //       missing: txResult[1] || result.missing,
      //     }
      // );
    } else {
      this.txResults.set(hash, [txResult[0] - 1, txResult[1] || result.missing]);
    }
  }

  async closePool(): Promise<any> {
    this.poolClient.release();

    await this.pool.end();
  }

  subscribeToEvents(): Client {
    const client = new Client(this.configService.get('NEAR_STREAMER_SQL_DATABASE_URL'));

    client.connect();

    client.query(`listen new_indexer_tx_event`, (err, res) => {
      if (err != null) {
        this.logger.error('Failed to subscribe to `new_indexer_tx_event` notifications', err);
      } else {
        this.logger.log('Successfully subscribed to `new_indexer_tx_event` notifications');
      }
    });

    return client;
  }

  async fetchEventData(event): Promise<CommonTx[]> {
    const sql = `select *
                 from indexer_tx_event
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

    this.nearTxHelper.getReceiptTree(tx).forEach((rcpt) => {
      this.findAndTransformFunctionCalls(rcpt, tx, commonTxs);

      if (tx.contains_event) {
        this.findAndTransformNftEvents(rcpt, tx, commonTxs);
      }
    });

    this.txResults.set(tx.hash, [commonTxs.length, false]);

    return commonTxs;
  }

  findAndTransformFunctionCalls(rcpt: Receipt, tx: TxEvent, commonTxs: CommonTx[]) {
    rcpt.function_calls.forEach((fc) => {
      const indexer = this.defineFunctionCallIndexer(fc, rcpt, tx);

      if (indexer) {
        commonTxs.push({
          hash : tx.hash,
          block_hash: tx.block_hash,
          block_timestamp: this.txHelper.nanoToMiliSeconds(tx.block_timestamp),
          block_height: tx.block_height,
          nonce: tx.nonce,
          signer: tx.signer_id,
          receiver: tx.receiver_id,
          function_name: fc.method_name,
          indexer_name: (indexer !== 'def') ? indexer : null,
          args: fc.args,
          receipts: [rcpt]
        });
      }
    });
  }

  defineFunctionCallIndexer(fc: FunctionCall, rcpt: Receipt, tx: TxEvent) : string {
    // TODO...
    return 'def';
  }

  findAndTransformNftEvents(rcpt: Receipt, tx: TxEvent, commonTxs: CommonTx[]) {
    const prefix = 'EVENT_JSON:';

    rcpt.logs.forEach((l) => {
      if (l.startsWith(prefix)) {
        const nft: NftEvent = JSON.parse(l.replace(prefix, ''))

        commonTxs.push({
          hash : tx.hash,
          block_hash: tx.block_hash,
          block_timestamp: this.txHelper.nanoToMiliSeconds(tx.block_timestamp),
          block_height: tx.block_height,
          nonce: tx.nonce,
          signer: tx.signer_id,
          receiver: tx.receiver_id,
          function_name: nft.event,
          indexer_name: nft.event,
          args: nft.data,
          receipts: [rcpt]
        });
      }
    });

    rcpt.receipts?.forEach((r) => {
      this.findAndTransformNftEvents(r, tx, commonTxs)
    });
  }
}