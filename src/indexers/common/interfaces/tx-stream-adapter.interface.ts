import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";
import { Client } from 'pg';

export interface CommonTxResult {
  txs: CommonTx[],
  total: number
};

export interface TxStreamAdapter {
  fetchTxs(batch_size: number, skip: number): Promise<CommonTxResult>;
  fetchMissingTxs(batch_size: number, skip: number): Promise<CommonTxResult>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;

  subscribeToEvents?(): Client;
  fetchEventData?(event: any): Promise<CommonTx[]>;
}
