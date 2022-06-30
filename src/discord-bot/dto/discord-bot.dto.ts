export interface DiscordBotDto {
  slug: string;
  title: string;
  rarity: number;
  ranking: number;
  collectionSize: number;
  price: number;
  marketplaceLink?: string;
  transactionLink: string;
  seller?: string;
  buyer?: string;
  image: string;
}

