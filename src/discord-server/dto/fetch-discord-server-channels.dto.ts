import { DiscordChannelType } from "@prisma/client"

export interface fetchDiscordServerChannels {
    slug: string
    purpose: DiscordChannelType
  }