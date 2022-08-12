export interface DiscordBotDto {
  slug: string;
  title: string;
  rarity: number;
  ranking: number;
  collectionSize: number;
  cryptoCurrency: string;
  price: number;
  marketplaceLink?: string;
  transactionLink: string;
  seller?: string;
  buyer?: string;
  sellerLink?: string;
  buyerLink?: string;
  image: string;
}