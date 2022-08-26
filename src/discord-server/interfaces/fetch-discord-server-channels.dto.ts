import { DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";

export interface fetchDiscordServerChannels {
  slug: string;
  purpose: DiscordChannelType;
  marketplace?: string;
}
