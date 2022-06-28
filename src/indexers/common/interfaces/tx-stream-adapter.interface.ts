import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { CommonTx } from "./common-tx.interface";

export interface TxStreamAdapter {
  fetchTxs(): Promise<CommonTx[]>;
  fetchMissingTxs(): Promise<CommonTx[]>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;
}
