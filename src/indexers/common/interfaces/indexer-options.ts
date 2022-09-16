﻿import { IndexerEventType } from "../helpers/indexer-enums";

export interface IndexerOptions {
  includeMissings: boolean;
  contract_key?: string;
  start_block_height?: number;
  end_block_height?: number;
}

export interface IndexerSubscriptionOptions {
  event: IndexerEventType;
}
