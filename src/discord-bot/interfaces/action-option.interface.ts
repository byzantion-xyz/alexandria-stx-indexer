import { ColorResolvable } from "discord.js";
import { ActionName, DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";

export interface ActionOption {
  name: ActionName,
  color: ColorResolvable,
  titlePrefix?: string,
  titleSuffix: string,
  purpose: DiscordChannelType
};

export const actionOptions: ActionOption[] = [
  {
    name: ActionName.bid,
    color: 'ORANGE',
    titlePrefix: 'New bid:',
    titleSuffix: '',
    purpose: DiscordChannelType.bids
  },
  {
    name: ActionName.collection_bid,
    color: 'DARK_ORANGE',
    titlePrefix: 'Collection bid:',
    titleSuffix: '',
    purpose: DiscordChannelType.bids
  },
  {
    name: ActionName.attribute_bid,
    color: 'DARK_ORANGE',
    titlePrefix: 'Attribute bid:',
    titleSuffix: '',
    purpose: DiscordChannelType.bids
  },
  {
    name: ActionName.accept_bid,
    color: 'GREEN',
    titlePrefix: 'Bid accepted:',
    titleSuffix: '',
    purpose: DiscordChannelType.bids
  },
  {
    name: ActionName.accept_collection_bid,
    color: 'DARK_GREEN',
    titlePrefix: 'Collection bid accepted:',
    titleSuffix: '',
    purpose: DiscordChannelType.bids
  },
  {
    name: ActionName.accept_attribute_bid,
    color: 'DARK_GREEN',
    titlePrefix: 'Attribute bid accepted:',
    titleSuffix: '',
    purpose: DiscordChannelType.bids
  },
  {
    name: ActionName.list,
    color: 'YELLOW',
    titleSuffix: 'has been listed for sale',
    purpose: DiscordChannelType.listings
  },
 {
    name: ActionName.buy,
    color: 'BLUE',
    titleSuffix: 'has been sold',
    purpose: DiscordChannelType.sales
  }
]
