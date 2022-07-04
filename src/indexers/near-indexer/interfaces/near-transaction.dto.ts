import {
  TransactionsOutcome,
  TransactionsTransaction,
  ReceiptsReceipt,
  //ReceiptsExecutionOutcome
} from '@internal/prisma/client';
import { ExecutionOutcomeWithIdView } from 'near-api-js/lib/providers/provider';

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