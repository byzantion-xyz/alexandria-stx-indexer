import { IndexerEventType } from "../helpers/indexer-enums"

export interface IndexerOptions {
  includeMissings: boolean,
  contract_key?: string
}

export interface IndexerSubscriptionOptions {
  event: IndexerEventType
}

