import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client, ColorResolvable, MessageAttachment, MessageEmbed } from 'discord.js';

import { BotHelperService } from './bot-helper.service';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { Action, NftMeta, NftState, SmartContract } from '@prisma/client';

@Injectable()
export class ListBotService {
  private readonly logger = new Logger(ListBotService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
    private botHelper: BotHelperService
  ) { }

  async send(data: DiscordBotDto) {
    try {
       // TODO: Use provider to fetch channel and server data from contract_key
      const server = { channel_id: '948998237040283709', server_name: 'Byzantion test' };

      const subTitle = 'has been listed for sale';
      const color: ColorResolvable = 'YELLOW';
      let messageContent = await this.botHelper.buildMessage(data, server, color, subTitle);

      await this.botHelper.sendMessage(messageContent, server);
    } catch (err) {
      this.logger.warn('Discord error', err);
    }
  }

  async createAndSend(nftMeta: NftMeta, nftState: NftState, action: Action, sc: SmartContract) {
    const data: DiscordBotDto = this.botHelper.createDiscordBotDto(nftMeta, nftState, action, sc);
    await this.send(data);
  }
}

