import { Action, SmartContract, SmartContractFunction } from "@prisma/client";
import { CommonTx } from "./common-tx.interface";
import { CreateAction } from "./create-action-common.dto";
import { TxProcessResult } from "./tx-process-result.interface";

export interface IndexerService {
  process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult>;
  createAction(params: CreateAction): Promise<Action>;
}