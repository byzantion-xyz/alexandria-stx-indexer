
import { ExecutionOutcomeWithIdView } from 'near-api-js/lib/providers/provider';
import { ReceiptsReceipt, TransactionsOutcome, TransactionsTransaction } from '../dto/near-transaction-types';

export interface Transaction {
  hash: string;
  outcome: TransactionsOutcome;
  transaction: TransactionsTransaction;
  receipt: ReceiptsReceipt;
  execution_outcome: ExecutionOutcomeWithIdView
  block_hash: string;
  block_timestamp: bigint; 
  block_height: bigint;
  missing: boolean;
  processed: boolean;
}