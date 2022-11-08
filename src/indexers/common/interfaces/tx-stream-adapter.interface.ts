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

export interface TxStreamAdapter {
  connectPool(): Promise<any>;
  closePool(): Promise<any>;

  fetchTxs(options: IndexerOptions): Promise<TxCursorBatch>;
  transformTxs(txs): CommonTx[];

  setTxResult(tx: CommonTx, txResult: TxProcessResult): void;
  saveTxResults(): void;

  subscribeToEvents?(): Client;
  fetchEventData?(event: any): Promise<CommonTx[]>;

}
