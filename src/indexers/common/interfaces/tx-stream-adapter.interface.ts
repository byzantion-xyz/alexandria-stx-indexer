import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";
import { Client } from 'pg';

export interface CommonTxResult {
  txs: CommonTx[],
  total: number
};

export interface TxStreamAdapter {
  fetchTxs(contract_key?: string): Promise<any>;
  fetchMissingTxs(contract_key?: string): Promise<any>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;

  subscribeToEvents?(): Client;
  fetchEventData?(event: any): Promise<CommonTx[]>;

  transformTxs(txs): CommonTx[];
}
