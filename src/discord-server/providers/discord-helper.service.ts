import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { AnyChannel, Client } from 'discord.js';

interface ChannelInServer {
  server_exists: boolean,
  channel_in_server: boolean
}

@Injectable()
export class DiscordHelperService {
  private readonly logger = new Logger(DiscordHelperService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
  ) {}

  async isChannelOnServer(channel_id: string, server_id: string): Promise<ChannelInServer> {
    let result: ChannelInServer = { server_exists: false, channel_in_server: false };
    try {
      const guild = await this.client.guilds.fetch(server_id);
      result.server_exists = guild ? true : false;     
      const channel: AnyChannel = await guild.channels.fetch(channel_id);
      result.channel_in_server = channel && channel.guildId == server_id ? true : false;
    } catch (err) {
      console.error(err);
    } finally {
      return result;
    }
  }

}
