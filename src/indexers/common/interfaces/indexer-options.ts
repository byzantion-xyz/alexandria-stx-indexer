import { IndexerEventType } from "../helpers/indexer-enums"

export interface IndexerOptions {
  includeMissings: boolean
}

export interface IndexerSubscriptionOptions {
  event: IndexerEventType
}

