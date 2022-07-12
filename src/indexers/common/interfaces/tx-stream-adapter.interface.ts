import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";
import { Client } from 'pg';

export interface TxStreamAdapter {
  fetchTxs(): Promise<CommonTx[]>;
  fetchMissingTxs(batch_size: number, skip: number): Promise<CommonTx[]>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;
  
  subscribeToEvents?(): Client;
  fetchEventData?(event: any): Promise<CommonTx[]>;
}
