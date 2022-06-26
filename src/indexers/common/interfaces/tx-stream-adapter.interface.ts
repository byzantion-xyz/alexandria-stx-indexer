import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { Transaction } from "src/indexers/near-indexer/dto/near-transaction.dto";

export interface TxStreamAdapter {

  fetchTxs(): Promise<Transaction[]>;
  fetchMissingTxs(): Promise<Transaction[]>;
  setTxResult(txHash: string, txResult: TxProcessResult): void;

}
