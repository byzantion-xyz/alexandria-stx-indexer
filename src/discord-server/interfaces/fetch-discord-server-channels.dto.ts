import { DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";
import { FetchUniversalChannels } from "./fetch-universal-channels.interface";

export interface FetchDiscordServerChannels extends FetchUniversalChannels {
  slug: string;
  purpose: DiscordChannelType;
  chainSymbol: string;
  marketplace?: string;
}
