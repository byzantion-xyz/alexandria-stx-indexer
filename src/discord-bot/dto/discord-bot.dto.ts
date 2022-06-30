export interface DiscordBotDto {
  slug: string;
  title: string;
  rarity: number;
  ranking: number;
  price: string;
  marketplaceLink?: string;
  transactionLink: string;
  seller?: string;
  buyer?: string;
  image: string;
}

