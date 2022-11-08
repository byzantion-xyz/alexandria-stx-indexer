import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";
import { Client, Pool, PoolClient } from 'pg';
import { IndexerOptions } from "./indexer-options";

export interface TxResult {
  hash: string,
  processed: boolean,
  missingNftEvent: boolean,
  matchingFunctionCall: boolean,
  skipped: string[],
  totalCommonTxs?: number
}

export interface ProcessedTxsResult {
  total: number;
}

export interface TxCursorBatch {
  cursor: any
}

export abstract class TxStreamAdapter {
  pool: Pool;
  poolClient: PoolClient;
  chainSymbol: string;
  streamerDbUri: string;

  constructor(chainSymbol: string, dbUri: string) {
    this.chainSymbol = chainSymbol;
    this.streamerDbUri = dbUri;
  }

  async connectPool(dbUri: string): Promise<any> {
    this.pool = new Pool({ connectionString: dbUri });
    this.poolClient = await this.pool.connect();
  }

  async closePool(): Promise<any> {
    this.poolClient.release();
    await this.pool.end();
  }

  abstract fetchTxs(options: IndexerOptions): Promise<TxCursorBatch>;
  abstract transformTxs(txs): CommonTx[];

  abstract setTxResult(tx: CommonTx, txResult: TxProcessResult): void;
  abstract saveTxResults(): void;

  abstract subscribeToEvents?(): Client;
  abstract fetchEventData?(event: any): Promise<CommonTx[]>;
}
