import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client } from 'pg';
import * as moment from "moment";
import { Transaction as TransactionEntity } from 'src/database/stacks-stream/entities/Transaction';
import { IndexerEventType } from 'src/indexers/common/helpers/indexer-enums';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxStreamAdapter } from 'src/indexers/common/interfaces/tx-stream-adapter.interface';
import { Repository } from 'typeorm';
import { StacksTransaction } from '../dto/stacks-transaction.dto';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class StacksTxStreamAdapterService implements TxStreamAdapter {
  private readonly logger = new Logger(StacksTxStreamAdapterService.name);

  constructor (
    private configService: ConfigService,
    private stacksTxHelper: StacksTxHelperService,
    @InjectRepository(TransactionEntity, "STACKS-STREAM")
    private transactionRepository: Repository<TransactionEntity>,
  ) {}

  async fetchTxs(): Promise<CommonTx[]> {
    const sql = `SELECT * from transaction t
      WHERE tx->>'tx_type' = 'contract_call' AND
      tx->>'tx_status' = 'success' AND
      processed = false AND  missing = false
      ORDER BY t.block_height ASC, tx->>'microblock_sequence' asc, tx->>'index' ASC 
      limit 2000;
    `;

    const txs: StacksTransaction[] = await this.transactionRepository.query(sql);
    const result: CommonTx[] = this.transformTxs(txs);
    
    return result;
  }

  async fetchMissingTxs(batch_size: number, skip: number): Promise<CommonTx[]> {
    const sql = `SELECT * from transaction t
      WHERE tx->>'tx_type' = 'contract_call' AND
      tx->>'tx_status' = 'success' AND
      processed = false AND  missing = true
      ORDER BY t.block_height ASC, tx->>'microblock_sequence' asc, tx->>'index' ASC 
      limit ${batch_size} offset ${skip};
    `;

    const txs: StacksTransaction[] = await this.transactionRepository.query(sql);
    const result: CommonTx[] = this.transformTxs(txs);
    
    return result;
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
      const args = tx.tx.contract_call.function_args;
      let parsed_args;
      if (args) {
        parsed_args = this.stacksTxHelper.parseHexArguments(args);
      }

      const notify = moment(new Date((tx.tx.burn_block_time))).utc() > moment().subtract(2, "hours").utc()
        ? true
        : false;

      return {
        hash: tx.hash,
        block_hash: tx.tx.block_hash,
        block_timestamp: BigInt(tx.tx.burn_block_time),
        block_height: tx.block_height,
        nonce: BigInt(tx.tx.nonce),
        signer: tx.tx.sender_address,
        receiver: tx.tx.contract_call.contract_id,
        function_name: tx.tx.contract_call.function_name,
        args: parsed_args,
        notify,
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
      WHERE block_height=${event} AND
      tx->>'tx_type' = 'contract_call' AND
      tx->>'tx_status' = 'success' AND
      processed = false AND  missing = false
      ORDER BY tx->>'microblock_sequence' asc, tx->>'index' ASC;
    `;

    const txs: StacksTransaction[] = await this.transactionRepository.query(sql);
    const result: CommonTx[] = this.transformTxs(txs);
  
    return result;
  }
}
