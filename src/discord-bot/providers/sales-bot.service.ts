import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { NftMeta, NftState } from '@prisma/client';
import { Client, ColorResolvable } from 'discord.js';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { BotHelperService } from './bot-helper.service';

@Injectable()
export class SalesBotService {
  private readonly logger = new Logger(SalesBotService.name);

  constructor(
    private botHelper: BotHelperService
  ) { }

  async send(data: DiscordBotDto) {
    try {
      // TODO: Use provider to fetch channel and server data from contract_key
      const server = { channel_id: '948998237040283709', server_name: 'Byzantion test' };

      const subTitle = 'has been sold';
      const color: ColorResolvable = 'BLUE';
      let messageContent = await this.botHelper.buildMessage(data, server, color, subTitle);

      await this.botHelper.sendMessage(messageContent, server);
    } catch (err) {
      this.logger.warn('Discord error', err);
    }
  }
}
