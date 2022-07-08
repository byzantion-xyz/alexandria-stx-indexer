import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";
import { Client } from 'pg';
import { IndexerEventType } from "../helpers/indexer-enums";

export interface TxStreamAdapter {
  fetchTxs(): Promise<CommonTx[]>;
  fetchMissingTxs(): Promise<CommonTx[]>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;
  
  subscribeToEvents?(): Client;
  fetchEventData?(event: any, eventType: IndexerEventType): Promise<CommonTx[]>;
}
