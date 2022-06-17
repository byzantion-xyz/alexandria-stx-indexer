import { DiscordChannelType } from "@prisma/client"

export interface createDiscordServer {
  server_id: string
  server_name: string
  active: boolean
  discord_server_channels?: createDiscordServerChannel[]
}

export interface createDiscordServerChannel {
  channel_id:    string 
  name:          string 
  purpose:       DiscordChannelType
  smart_contract_ids?: String[]
}