import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Collection, Action, NftMeta, SmartContract, NftState } from '@prisma/client';
import axios from 'axios';
import { Client, ColorResolvable, MessageAttachment, MessageEmbed } from 'discord.js';
import * as sharp from 'sharp';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoRateService } from './crypto-rate.service';

@Injectable()
export class BotHelperService {
  private readonly logger = new Logger(BotHelperService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
    private readonly prismaService: PrismaService,
    private readonly cryptoRateService: CryptoRateService
  ) { }

  createDiscordBotDto(nftMeta: NftMeta, collection: Collection, sc: SmartContract, msc: SmartContract, action: Action): DiscordBotDto {
    let marketplaceLink: string;
    if (msc) {
      marketplaceLink = msc.base_marketplace_uri + msc.token_uri + 
      sc.contract_key + '::' + nftMeta.token_id + '/' + nftMeta.token_id;
    }

    let seller: string;
    let buyer: string;
    if (action.seller) seller = action.seller;
    if (action.buyer) buyer = action.buyer;

    const transactionLink = `https://explorer.near.org/transactions/${action.tx_id}`;

    return {
      slug: collection.slug,
      title: nftMeta.name,
      rarity: nftMeta.rarity,
      ranking: nftMeta.ranking,
      collectionSize: collection.collection_size,
      price: Number(Number(action.list_price) / 1e24),
      ... (marketplaceLink && { marketplaceLink}),
      transactionLink,
      ... (seller && { seller}),
      ... (buyer && { buyer}),
      image: nftMeta.image
    };
  }

  async sendMessage(message, channel_id: string) {
    const channel = await this.client.channels.fetch(channel_id);
    console.log("channel", channel)
    if (channel.type === 'GUILD_TEXT') {
      await channel.send(message);
    } else {
      this.logger.warn('Not a valid text channel');
    }
  }

  async buildMessage(data: DiscordBotDto, server_name: string, color: ColorResolvable, subTitle: string) {
    const { title, rarity, ranking, collectionSize, price, marketplaceLink, transactionLink, image } = data;

    const embed = new MessageEmbed().setColor(color);
    let attachments = [];

    const roundedRarity: number = rarity ? Math.round(rarity * 100) / 100 : 0;

    embed.setTitle(`${title} ${subTitle}`);
    if (marketplaceLink) {
      embed.setURL(marketplaceLink);
    }

    let priceInUSD: number;
    const nearToUSDRate = await this.cryptoRateService.getNearToUSDRate();
    if (nearToUSDRate) {
      priceInUSD = Number(nearToUSDRate) * Number(price);
      priceInUSD = Math.round((priceInUSD + Number.EPSILON) * 100) / 100;
    }

    embed.setDescription(`
      **Rarity Ranking**: ${ranking}/${collectionSize}
      **Rarity Score**: ${roundedRarity}
      **Price**: ${Number(price).toFixed(2)} NEAR ($${priceInUSD} USD)
    `);

    let seller: string;
    if (data.seller) {
      seller = data.seller;
      if (data.seller && data.seller.length > 20) seller = data.seller.slice(0,5) + "..." + data.seller.slice(-5)
    }

    let buyer: string;
    if (data.buyer) {
      buyer = data.buyer;
      if (data.buyer && data.buyer.length > 20) buyer = data.buyer.slice(0,5) + "..." + data.buyer.slice(-5)
    }

    //embed.addField('Attributes', `[View](${byzFinalLink})`, true);
    if (seller) embed.addField(`Seller`, `[${seller}](https://paras.id/${data.seller}/collectibles)`, true);
    if (buyer) embed.addField(`Buyer`, `[${buyer}](https://paras.id/${data.buyer}/collectibles)`, true);
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

    embed.setFooter({ text: 'Powered by Byzantion.xyz', iconURL: 'https://res.cloudinary.com/daxts7gzz/image/upload/v1656619671/byz-logo-2.webp' });

    return { embeds: [embed], files: attachments };
  }

  async fetchActionData(actionId: string): Promise<DiscordBotDto> {
    const action = await this.prismaService.action.findUnique({
      where: { id: actionId },
      include: {
        nft_meta: {
          include: {
            nft_state: true,
            smart_contract: true,
            collection: true
          }
        },
        collection: true,
        marketplace_smart_contract: true
      }
    });
    const data: DiscordBotDto = this.createDiscordBotDto(
      action.nft_meta,
      action.collection,
      action.nft_meta.smart_contract,
      action.marketplace_smart_contract,
      action
    );

    return data;
  }

}
