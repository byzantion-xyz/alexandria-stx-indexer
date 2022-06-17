import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Action, NftMeta, NftState, SmartContract } from '@prisma/client';
import axios from 'axios';
import { Client, ColorResolvable, MessageAttachment, MessageEmbed } from 'discord.js';
import * as sharp from 'sharp';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BotHelperService {
  private readonly logger = new Logger(BotHelperService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
    private readonly prismaService: PrismaService,
  ) { }

  createDiscordBotDto(nftMeta: NftMeta, sc: SmartContract, msc: SmartContract, action: Action): DiscordBotDto {
    const marketplaceLink = msc.base_marketplace_uri + msc.token_uri + 
      sc.contract_key + '::' + nftMeta.token_id + '/' + nftMeta.token_id;
    const transactionLink = `https://explorer.near.org/transactions/${action.tx_id}`;

    return {
      contract_key: sc.contract_key,
      title: nftMeta.name,
      rarity: nftMeta.rarity,
      price: `${Number(Number(action.list_price) / 1e24).toFixed(2)} NEAR`, // TODO: Round to USD also
      marketplaceLink,
      transactionLink,
      image: nftMeta.image
    };
  }

  async sendMessage(message, channel_id: string) {
    const channel = await this.client.channels.fetch(channel_id);
    if (channel.type === 'GUILD_TEXT' && process.env.NODE_ENV === 'production') {
      await channel.send(message);
    } else {
      this.logger.warn('Not a valid text channel');
    }
  }

  async buildMessage(data: DiscordBotDto, server_name: string, color: ColorResolvable, subTitle: string) {
    const { title, rarity, price, marketplaceLink, transactionLink, image } = data;

    const embed = new MessageEmbed().setColor(color);
    let attachments = [];

    const roundedRarity: number = rarity ? Math.round(rarity * 100) / 100 : 0;

    embed.setTitle(`${title} ${subTitle}`);
    embed.setURL(marketplaceLink);
    embed.setDescription(`**Rarity**: ${roundedRarity}\n**Price**: ${price}`);
    //embed.addField('Attributes', `[View](${byzFinalLink})`, true);
    embed.addField('Transaction', `[View](${transactionLink})`, true);

    if (image) {
      try {
        const imgData = await axios.get(image, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imgData.data, 'binary');
        const resizedBuffer = await sharp(imageBuffer).resize(1024, 1024, { fit: 'inside' }).toBuffer();

        const imgTitle = image.split('/')[image.split('/').length - 1];
        const withEnding = imgTitle.includes('.') ? imgTitle : `${imgTitle}.png`;
        attachments.push(new MessageAttachment(resizedBuffer, withEnding));

        embed.setImage(`attachment://${withEnding}`);
      } catch (err) {
        console.error(err);
      }
    }

    if (embed.video) attachments = []; // Do not include video files
    embed.setTimestamp();

    return { embeds: [embed], files: attachments };
  }

  async fetchActionData(actionId: string): Promise<DiscordBotDto> {
    const action = await this.prismaService.action.findUnique({
      where: { id: actionId },
      include: {
        nft_meta: {
          include: {
            nft_state: true,
            smart_contract: true
          }
        },
        smart_contract: true,
        marketplace_smart_contract: true
      }
    });
    const data: DiscordBotDto = this.createDiscordBotDto(
      action.nft_meta,
      action.nft_meta.smart_contract,
      action.marketplace_smart_contract,
      action
    );

    return data;
  }

}
