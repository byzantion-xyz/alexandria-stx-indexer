import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Action, NftMeta, NftState, SmartContract } from '@prisma/client';
import { Client, ColorResolvable } from 'discord.js';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { PrismaService } from 'src/prisma.service';
import { BotHelperService } from './bot-helper.service';

@Injectable()
export class SalesBotService {
  private readonly logger = new Logger(SalesBotService.name);

  constructor(
    private botHelper: BotHelperService,
    private readonly prismaService: PrismaService
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

  async createAndSend(nftMetaId: string, txHash: string) {
    const nftMeta = await this.prismaService.nftMeta.findUnique({ 
      where: { id: nftMetaId },
      include: { nft_state: true, smart_contract: true }
    });
    const data: DiscordBotDto = this.botHelper.createDiscordBotDto(nftMeta, nftMeta.nft_state, nftMeta.smart_contract, txHash);
    await this.send(data);
  }
}
