
import { ContractCallTransaction, SmartContractTransaction } from '@stacks/stacks-blockchain-api-types';

export interface StacksTransaction {
  hash: string;
  tx: ContractCallTransaction | SmartContractTransaction
  block_height: bigint;
  contract_id: string;
  missing: boolean;
  processed: boolean;
}