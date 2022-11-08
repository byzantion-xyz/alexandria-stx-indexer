import { CommonTx } from "./common-tx.interface";
import { CreateActionTO } from "./create-action-common.dto";
import { TxProcessResult } from "./tx-process-result.interface";
import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";

export interface IndexerService {
  marketScs?: SmartContract[];
  stakingScs?: SmartContract[];

  process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult>;
  createAction(params: CreateActionTO): Promise<Action>;
}
