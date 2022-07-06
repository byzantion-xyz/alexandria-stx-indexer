import { CommonTx } from "./common-tx.interface";
import { CreateActionTO } from "./create-action-common.dto";
import { TxProcessResult } from "./tx-process-result.interface";
import { Action } from "src/entities/Action";
import { SmartContract } from "src/entities/SmartContract";
import { SmartContractFunction } from "src/entities/SmartContractFunction";

export interface IndexerService {
  process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult>;
  createAction(params: CreateActionTO): Promise<Action>;
}
