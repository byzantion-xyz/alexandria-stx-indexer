import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ColorResolvable } from 'discord.js';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { BotHelperService } from './bot-helper.service';
import { DiscordServerService } from 'src/discord-server/providers/discord-server.service';
import { DiscordChannelType } from 'src/indexers/common/helpers/indexer-enums';

@Injectable()
export class SalesBotService {
  private readonly logger = new Logger(SalesBotService.name);

  constructor(
    private botHelper: BotHelperService,
    private discordServerService: DiscordServerService
  ) { }

  async send(data: DiscordBotDto) {
    try {
      const channels = await this.discordServerService.fetchChannelsBySlug(data.slug, DiscordChannelType.sales);
      const subTitle = 'has been sold';
      const color: ColorResolvable = 'BLUE';

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
    const data: DiscordBotDto = await this.botHelper.fetchActionData(actionId);
    await this.send(data);
  }
}