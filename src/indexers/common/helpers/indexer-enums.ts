/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

export enum SmartContractType {
  non_fungible_tokens = "non_fungible_tokens",
  token_series = "token_series",
  marketplace = "marketplace",
  staking = "staking",
  fungible_tokens = "fungible_tokens",
  bridge = "bridge",
}

export enum CollectionBidStatus {
  active = "active",
  pending = "pending",
  cancelled = "cancelled",
  matched = "matched",
}

export enum BidType {
  collection = "collection",
  attribute = "attribute",
  solo = "solo",
}

export enum CollectionScrapeStage {
  getting_tokens = "getting_tokens",
  pinning_folder = "pinning_folder",
  loading_nft_metas = "loading_nft_metas",
  updating_rarities = "updating_rarities",
  creating_collection_attributes = "creating_collection_attributes",
  pinning_multiple_images = "pinning_multiple_images",
  done = "done",
}

export enum CollectionScrapeOutcome {
  skipped = "skipped",
  succeeded = "succeeded",
  failed = "failed",
}

export enum ActionName {
  list = "list",
  unlist = "unlist",
  buy = "buy",
}

export enum DiscordChannelType {
  sales = "sales",
  listings = "listings",
  bids = "bids",
}
