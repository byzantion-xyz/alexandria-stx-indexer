import { DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";

export interface FetchUniversalChannels {
  purpose: DiscordChannelType;
  chainId: string;
  marketplace?: string;
}