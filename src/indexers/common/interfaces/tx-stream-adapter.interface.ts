import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";
import { Client, Pool, PoolClient } from 'pg';
import { IndexerOptions } from "./indexer-options";

export interface CommonTxResult {
  txs: CommonTx[],
  total: number
};

export interface ProcessedTxsResult {
  total: number;
}

export interface TxCursorBatch {
  cursor: any
}

export interface TxStreamAdapter {
  connectPool(): Promise<PoolClient>;
  fetchTxs(options: IndexerOptions): Promise<TxCursorBatch>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;
  closePool(): Promise<any>;

  subscribeToEvents?(): Client;
  fetchEventData?(event: any): Promise<CommonTx[]>;

  transformTxs(txs): CommonTx[];
}
