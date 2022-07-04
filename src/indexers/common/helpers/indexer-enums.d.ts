/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

export const SmartContractType: {
  non_fungible_tokens: "non_fungible_tokens";
  token_series: "token_series";
  marketplace: "marketplace";
  staking: "staking";
  fungible_tokens: "fungible_tokens";
  bridge: "bridge";
};

export type SmartContractType = typeof SmartContractType[keyof typeof SmartContractType];

export const CollectionBidStatus: {
  active: "active";
  pending: "pending";
  cancelled: "cancelled";
  matched: "matched";
};

export type CollectionBidStatus = typeof CollectionBidStatus[keyof typeof CollectionBidStatus];

export const BidType: {
  collection: "collection";
  attribute: "attribute";
  solo: "solo";
};

export type BidType = typeof BidType[keyof typeof BidType];

export const CollectionScrapeStage: {
  getting_tokens: "getting_tokens";
  pinning_folder: "pinning_folder";
  loading_nft_metas: "loading_nft_metas";
  updating_rarities: "updating_rarities";
  creating_collection_attributes: "creating_collection_attributes";
  pinning_multiple_images: "pinning_multiple_images";
  done: "done";
};

export type CollectionScrapeStage = typeof CollectionScrapeStage[keyof typeof CollectionScrapeStage];

export const CollectionScrapeOutcome: {
  skipped: "skipped";
  succeeded: "succeeded";
  failed: "failed";
};

export type CollectionScrapeOutcome = typeof CollectionScrapeOutcome[keyof typeof CollectionScrapeOutcome];

export const ActionName: {
  list: "list";
  unlist: "unlist";
  buy: "buy";
};

export type ActionName = typeof ActionName[keyof typeof ActionName];

export const DiscordChannelType: {
  sales: "sales";
  listings: "listings";
  bids: "bids";
};

export type DiscordChannelType = typeof DiscordChannelType[keyof typeof DiscordChannelType];
