import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client } from 'pg';
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
import { SmartContract } from 'src/database/universal/entities/SmartContract';

const BNS_CONTRACT_KEY = 'SP000000000000000000002Q6VF78.bns::names';
// Btc domain marketplaces
const EXCLUDED_SMART_CONTRACTS = [
  'SP000000000000000000002Q6VF78.bns',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace-v1',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace-v3',
  'SP3XYJ8XFZYF7MD86QQ5EF8HBVHHZFFQ9HM6SPJNQ.market',
  'SP3XYJ8XFZYF7MD86QQ5EF8HBVHHZFFQ9HM6SPJNQ.instant-regist',
  'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60.pool-registry',
  'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60.pool-registry-v1',
  'SP3A6FJ92AA0MS2F57DG786TFNG8J785B3F8RSQC9.owl-link',
  'SP1N3865XAA3BHRSDG8ZCR58HF74541F0F91SXPQ5.register-multi',
  'SPCHKJ49HXP2CJ2PDCHQ2NC40TJBSYPWVXX99SBM.bns-1666908872969-v1',
  'SP1CS7R196SBKRP38QKJ3B6BAY0504P72EGYC9WZ5.bns-1666034732909-v1',
  'SP1N3865XAA3BHRSDG8ZCR58HF74541F0F91SXPQ5.register-multi',
  'SP251VH8CE3CCBKZHBJX2GW4SWAHT6X6N5T962QK3.bns-1666435087024-v1',
  'SPYZJ11GZP4B5JGMWPFFJWNJ5DMXW17AKBVQQ4J2.bns-1666427545320-v1',
  'SP17QGCDJFHJ8MNFY3N1V2M0P620AGRDZ7XJ2BQR1.bns-1666434029301-v1',
  'SP11EJYV0PJKKX92R16KKV0J3E0T5MWE2VQ70NDFB.bns-1666438515774-v1',
  'SP32G7RSR5ZMFBD1494PZWHB1N3THA4WTJZC6T88M.bns-1666441714432-v1',
  'SP6Z867FTR4SZFR9MW23K30XHGF12E3PDRC04EXM.bns-instant-register',
  'SP39WQ90WHTTN6BTTW8GST8FJXPZVVX8R2JESYT44.bns-1664872470359-v1',
  'SP1MT9ZCBE8NZ2ACGD8EVYQAAHP98EY0GQSFQKCJN.bns-1665193051606-v1',
  'SP3RZCB3QWNYCJB3TMAHDTARQ0NBMZGZ4HCJ02M76.bns-1667163108546-v1',
  'SP1Q15X8SQ51GK5V1V2KZ025HW8VYK29HHWWXMRGG.bns-1667169357547-v1',
  'SP2C20XGZBAYFZ1NYNHT1J6MGMM0EW9X7PFBWK7QG.amoritze-bns-marketplace'
];

@Injectable()
export class StacksTxStreamAdapterService extends TxStreamAdapter {
  private readonly chainSymbol = 'Stacks';
  private readonly logger = new Logger(StacksTxStreamAdapterService.name);

  private txBatchResults: TxResult[] = [];
  private readonly txResults = new ExpiryMap(this.configService.get('indexer.txResultExpiration') || 60000);

  constructor (
    private configService: ConfigService,
    private stacksTxHelper: StacksTxHelperService,
    private commonUtil: CommonUtilService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(TransactionEntity, "CHAIN-STREAM")
    private transactionRepository: Repository<TransactionEntity>
  ) {
    super();
  }

  async fetchSmartContract(contractKey: string): Promise<SmartContract> {
    return await this.smartContractRepository.findOne({
      where: {
        chain : { symbol: this.chainSymbol },
        contract_key: contractKey
      }
    });
  }

  async fetchTxs(options: IndexerOptions): Promise<TxCursorBatch> {
    const end_block_height = this.configService.get('indexer.blockRanges.Stacks.end_block_height') || 0;    
    
    let contract_key: string;
    if (options.contract_key) {
      let sc = await this.fetchSmartContract(options.contract_key);
      if (!sc) {
        throw new Error(`Couldn't find matching smart contract: ${options.contract_key}`)
      } 
      contract_key = sc.contract_key;
    }

    const sql = `SELECT * FROM transaction t
      WHERE block_height >= ${options.start_block_height ?? 0}
      AND block_height <= ${options.end_block_height ?? end_block_height}
      ${contract_key ? `AND contract_id='${contract_key}'` : ''}
      AND contract_id NOT IN (${EXCLUDED_SMART_CONTRACTS.map((key) => `'${key}'`).join(',')})
      AND tx->>'tx_status' = 'success'
      AND processed = ${options.includeMissings}
      AND missing = ${options.includeMissings}
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
      txResult[1].matchingFunctionCall = txResult[1].matchingFunctionCall || result.processed;
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
      const missing = res.missingNftEvent || (!res.matchingFunctionCall && res.totalCommonTxs === 1);
      return `('${res.hash}', ${res.processed}, ${missing}, ${skipped})`;
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
      
      if (tx.tx.tx_type === "contract_call") {
        const args = tx.tx.contract_call.function_args;
        const parsed_args = this.stacksTxHelper.parseHexArguments(args);

        commonTxs.push({
          function_name: tx.tx.contract_call.function_name,
          args: parsed_args,
          ...this.transformTxBase(commonTxs.length, tx)
        });
      }
      
      const nftEvents = tx.tx.event_count ? this.stacksTxHelper.getNftEvents(tx) : [];

      if (nftEvents.length) {
        nftEvents.forEach(e => {
          if (e.asset.asset_id !== BNS_CONTRACT_KEY) {
            commonTxs.push({
              function_name: 'nft_' + e.asset.asset_event_type + '_event',
              args: {
                event_index: e.event_index
              },
              ... this.transformTxBase(commonTxs.length, tx),
            });
          }         
        });
      }

      if (commonTxs.length) {
        this.txResults.set(tx.hash, [commonTxs.length, {
          hash : tx.hash,
          processed: true,
          missingNftEvent: false,
          matchingFunctionCall: false,
          skipped: [],
          totalCommonTxs: commonTxs.length
        } as TxResult]);
      }

      return commonTxs;
    } catch (err) {
      this.logger.warn(`transformTx() has failed for tx hash: ${tx.hash}`);
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
      receiver: tx.tx.tx_type === 'contract_call' ? tx.tx.contract_call.contract_id : tx.tx.smart_contract.contract_id,
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
      AND contract_id NOT IN (${EXCLUDED_SMART_CONTRACTS.map((key) => `'${key}'`).join(',')}) 
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
