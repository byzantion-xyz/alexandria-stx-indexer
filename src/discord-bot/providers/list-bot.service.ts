import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client, ColorResolvable, MessageAttachment, MessageEmbed } from 'discord.js';

import { BotHelperService } from '../bot-helper/bot-helper.service';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';

@Injectable()
export class ListBotService {
  private readonly logger = new Logger(ListBotService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
    private botHelper: BotHelperService
  ) { }

  async send(data: DiscordBotDto, server) {
    try {
      const subTitle = 'has been listed for sale';
      const color: ColorResolvable = 'YELLOW';
      let messageContent = await this.botHelper.buildMessage(data, server, color, subTitle);

      await this.botHelper.sendMessage(messageContent, server);
    } catch (err) {
      this.logger.warn('Discord error', err);
    }
  }
}

