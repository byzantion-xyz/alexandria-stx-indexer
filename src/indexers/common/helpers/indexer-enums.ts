/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

export enum IndexerEventType {
  block = "block",
  tx = "tx"
}

export enum SmartContractType {
  non_fungible_tokens = "non_fungible_tokens",
  token_series = "token_series",
  marketplace = "marketplace",
  staking = "staking",
  utility = "utility",
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
  accept_attribute_bid = "accept-attribute-bid",
  accept_bid = "accept-bid", 
  asking_price = "asking-price",
  attribute_bid = "attribute-bid",
  bid = "bid", 
  cancel_attribute_bid = "cancel-attribute-bid",
  cancel_collection_bid = "cancel-collection-bid", 
  collection_bid = "collection-bid",
  mint = "mint",  
  multi_attribute_bid = "multi-attribute-bid",
  multi_collection_bid = "multi-collection-bid",
  relist = "relist", 
  stake = "stake",
  transfer = "transfer",
  unlist_bid = "unlist-bid",
  unlist_collection_bid = "unlist-collection-bid",
  unstake = "unstake"
}



export enum DiscordChannelType {
  sales = "sales",
  listings = "listings",
  bids = "bids",
}
