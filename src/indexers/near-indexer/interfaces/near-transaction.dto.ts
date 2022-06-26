import {
  TransactionsOutcome,
  TransactionsTransaction,
  ReceiptsReceipt,
  ReceiptsExecutionOutcome
} from '@internal/prisma/client';

export interface Transaction {
  hash: string;
  outcome: TransactionsOutcome;
  transaction: TransactionsTransaction;
  receipt: ReceiptsReceipt;
  execution_outcome: ReceiptsExecutionOutcome;
  block_hash: string;
  block_timestamp: bigint;
  block_height: bigint;
  missing: boolean;
  processed: boolean;
}