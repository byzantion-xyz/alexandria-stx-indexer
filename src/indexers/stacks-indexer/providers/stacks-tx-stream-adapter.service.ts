import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client, Pool } from 'pg';
import * as Cursor from 'pg-cursor';
import * as moment from "moment";

import { Transaction as TransactionEntity } from 'src/database/stacks-stream/entities/Transaction';
import { IndexerEventType } from 'src/indexers/common/helpers/indexer-enums';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { CommonTxResult, TxStreamAdapter } from 'src/indexers/common/interfaces/tx-stream-adapter.interface';
import { In, Not, Repository } from 'typeorm';
import { StacksTransaction } from '../dto/stacks-transaction.dto';
import { StacksTxHelperService } from './stacks-tx-helper.service';
import { TransactionEvent } from '@stacks/stacks-blockchain-api-types';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { NearIndexerController } from 'src/indexers/near-indexer/near-indexer.controller';

@Injectable()
export class StacksTxStreamAdapterService implements TxStreamAdapter {
  private readonly logger = new Logger(StacksTxStreamAdapterService.name);

  constructor (
    private configService: ConfigService,
    private stacksTxHelper: StacksTxHelperService,
    @InjectRepository(TransactionEntity, "STACKS-STREAM")
    private transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async fetchTxs(contract_key?: string): Promise<any> {
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

    const sql = `SELECT * from transaction t
      WHERE t.contract_id IN (${accounts_in})
      AND tx->>'tx_type' = 'contract_call'
      AND tx->>'tx_status' = 'success'
      AND processed = false 
      AND missing = false
      ORDER BY t.block_height ASC, tx->>'microblock_sequence' asc, tx->>'index' ASC 
    `;

    const pool = new Pool({
      connectionString: this.configService.get('STACKS_STREAMER_SQL_DATABASE_URL')
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

    const sql = `SELECT * from transaction t
      WHERE t.contract_id IN (${accounts_in})
      AND tx->>'tx_type' = 'contract_call'
      AND tx->>'tx_status' = 'success' 
      AND processed = false 
      AND missing = true
      ORDER BY t.block_height ASC, tx->>'microblock_sequence' asc, tx->>'index' ASC 
    `;

    const pool = new Pool({
      connectionString: this.configService.get('STACKS_STREAMER_SQL_DATABASE_URL')
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
        block_timestamp: tx.tx.burn_block_time * 1000,
        block_height: tx.block_height,
        nonce: BigInt(tx.tx.nonce),
        index: BigInt(tx.tx.tx_index),
        signer: tx.tx.sender_address,
        receiver: tx.tx.contract_call.contract_id,
        function_name: tx.tx.contract_call.function_name,
        args: parsed_args,
        events: tx.tx.events,
        notify,
      };
    } catch (err) {
      this.logger.warn(`transormTx() has failed for tx hash: ${tx.hash}`);
    }
  }

  async fetchAccounts(): Promise<string[]> {
    const smartContracts: SmartContract[] = await this.smartContractRepository.find({
      where: { 
        chain: { symbol: "Stacks" },
        contract_key: Not(In([
          'SP000000000000000000002Q6VF78.bns', 
          'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace', 
          'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace-v1', 
          'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bns-marketplace-v3'
        ]))
      }
    });

    const accounts = smartContracts.map((sc) => sc.contract_key);

    return accounts;
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
