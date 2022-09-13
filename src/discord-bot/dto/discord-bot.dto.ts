import { ActionName, DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";

export interface DiscordBotDto {
  slug: string;
  title: string;
  rarity: number;
  ranking: number;
  collectionSize: number;
  cryptoCurrency: string;
  price: number;
  marketplace?: string;
  marketplaceLink?: string;
  transactionLink: string;
  seller?: string;
  buyer?: string;
  sellerLink?: string;
  buyerLink?: string;
  image: string;
  actionName: ActionName;
  chainId: string;
}
