import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";
import { Client } from 'pg';
import { IndexerOptions } from "./indexer-options";

export interface CommonTxResult {
  txs: CommonTx[],
  total: number
};

export interface ProcessedTxsResult {
  total: number;
}

export interface TxStreamAdapter {
  fetchTxs(options: IndexerOptions): Promise<any>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;

  subscribeToEvents?(): Client;
  fetchEventData?(event: any): Promise<CommonTx[]>;

  transformTxs(txs): CommonTx[];
}
