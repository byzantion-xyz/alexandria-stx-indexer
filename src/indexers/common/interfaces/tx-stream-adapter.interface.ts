import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";
import { Client, Pool, PoolClient } from 'pg';
import { IndexerOptions } from "./indexer-options";

export interface CommonTxResult {
  txs: CommonTx[],
  total: number
}

export interface NearTxResult {
  hash: string,
  processed: boolean,
  missingNftEvent: boolean,
  matchingFunctionCall: boolean,
  skipped: string[]
}

export interface StacksTxBatchResult {
  hash: string,
  processed: boolean,
  missing: boolean
}

export interface ProcessedTxsResult {
  total: number;
}

export interface TxCursorBatch {
  cursor: any
}

export interface TxStreamAdapter {
  connectPool(): Promise<PoolClient>;
  fetchTxs(options: IndexerOptions): Promise<TxCursorBatch>;
  setTxResult(tx: CommonTx, txResult: TxProcessResult): void;
  saveTxResults(): void;
  closePool(): Promise<any>;

  subscribeToEvents?(): Client;
  fetchEventData?(event: any): Promise<CommonTx[]>;

  transformTxs(txs): CommonTx[];
}
