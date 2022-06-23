import { TransactionsOutcome, TransactionsTransaction } from '@internal/prisma/client';

export interface Transaction {
    hash: string;
    outcome: TransactionsOutcome;
    transaction: TransactionsTransaction;
    block_hash: string;
    block_timestamp: bigint;
    block_height: bigint;
    missing: boolean;
    processed: boolean;
  }