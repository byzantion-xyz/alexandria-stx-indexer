import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client, ColorResolvable, MessageAttachment, MessageEmbed } from 'discord.js';

import { BotHelperService } from './bot-helper.service';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { Action, DiscordChannelType, NftMeta, NftState, SmartContract } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { DiscordServerService } from 'src/discord-server/providers/discord-server.service';

@Injectable()
export class ListBotService {
  private readonly logger = new Logger(ListBotService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
    private botHelper: BotHelperService,
    private readonly prismaService: PrismaService,
    private discordServerService: DiscordServerService
  ) { }

  async send(data: DiscordBotDto) {
    try {
      const channels = await this.discordServerService.fetchChannelsByContractKey(data.contract_key, DiscordChannelType.sales);

      const subTitle = 'has been listed for sale';
      const color: ColorResolvable = 'YELLOW';
      if (!channels || !channels.length) return;

      let messageContent = await this.botHelper.buildMessage(data, channels[0].discord_server.server_id, color, subTitle);
      await this.botHelper.sendMessage(messageContent, channels[0].channel_id);
    } catch (err) {
      this.logger.warn('Discord error', err);
    }
  }

  async createAndSend(nftMetaId: string, txHash: string) {
    const nftMeta = await this.prismaService.nftMeta.findUnique({ 
      where: { id: nftMetaId },
      include: { nft_state: true, smart_contract: true }
    });
    const data: DiscordBotDto = this.botHelper.createDiscordBotDto(nftMeta, nftMeta.nft_state, nftMeta.smart_contract, txHash);
    await this.send(data);
  }
}

