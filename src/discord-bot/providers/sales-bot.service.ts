import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Action, DiscordChannelType, NftMeta, NftState, SmartContract } from '@prisma/client';
import { Client, ColorResolvable } from 'discord.js';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { BotHelperService } from './bot-helper.service';
import { DiscordServerService } from 'src/discord-server/providers/discord-server.service';


@Injectable()
export class SalesBotService {
  private readonly logger = new Logger(SalesBotService.name);

  constructor(
    private botHelper: BotHelperService,
    private readonly prismaService: PrismaService,
    private discordServerService: DiscordServerService
  ) { }

  async send(data: DiscordBotDto) {
    try {
      const channels = await this.discordServerService.fetchChannelsByContractKey(data.contract_key, DiscordChannelType.listings);
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

  async createAndSend(nftMetaId: string, txHash: string) {
    const nftMeta = await this.prismaService.nftMeta.findUnique({ 
      where: { id: nftMetaId },
      include: { nft_state: true, smart_contract: true }
    });
    const data: DiscordBotDto = this.botHelper.createDiscordBotDto(nftMeta, nftMeta.nft_state, nftMeta.smart_contract, txHash);
    await this.send(data);
  }
}