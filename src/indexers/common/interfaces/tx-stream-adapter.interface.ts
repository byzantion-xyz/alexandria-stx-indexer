import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { Transaction } from "src/indexers/near-indexer/dto/near-transaction.dto";
import { CommonTx } from "./common-tx.interface";

export interface TxStreamAdapter {
  fetchTxs(): Promise<CommonTx[]>;
  fetchMissingTxs(): Promise<CommonTx[]>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;
}
