import { Injectable, Logger } from '@nestjs/common';
import { ColorResolvable } from 'discord.js';

import { BotHelperService } from './bot-helper.service';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { DiscordServerService } from 'src/discord-server/providers/discord-server.service';
import { DiscordChannelType } from 'src/indexers/common/helpers/indexer-enums';

@Injectable()
export class ListBotService {
  private readonly logger = new Logger(ListBotService.name);

  constructor(
    private botHelper: BotHelperService,
    private discordServerService: DiscordServerService
  ) { }

  async send(data: DiscordBotDto) {
    try {
      const channels = await this.discordServerService.fetchChannelsBySlug(data.slug, DiscordChannelType.listings);

      const subTitle = 'has been listed for sale';
      const color: ColorResolvable = 'YELLOW';
      if (!channels || !channels.length) return;

      for (let channel of channels) {
        let messageContent = await this.botHelper.buildMessage(data, channel.discord_server.server_id, color, subTitle);
        await this.botHelper.sendMessage(messageContent, channel.channel_id);
      }
    } catch (err) {
      this.logger.warn('Discord error', err);
    }
  }

  async createAndSend(actionId: string) {
    const action = await this.botHelper.fetchActionData(actionId);
    const data = await this.botHelper.createDiscordBotDto(action);

    await this.send(data);
  }

}

