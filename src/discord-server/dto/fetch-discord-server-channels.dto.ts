import { DiscordChannelType } from "@prisma/client"

export interface fetchDiscordServerChannels {
    contract_key: string
    purpose: DiscordChannelType
  }