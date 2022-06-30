import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Collection, Action, NftMeta, SmartContract, NftState } from '@prisma/client';
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

  createDiscordBotDto(nftMeta: NftMeta, collection: Collection, sc: SmartContract, msc: SmartContract, action: Action): DiscordBotDto {
    let marketplaceLink: string;
    if (msc) {
      marketplaceLink = msc.base_marketplace_uri + msc.token_uri + 
      sc.contract_key + '::' + nftMeta.token_id + '/' + nftMeta.token_id;
    }

    let seller: string;
    let buyer: string;
    if (action.action == "buy") {
      if (action.seller) seller = action.seller;
      if (action.buyer) buyer = action.buyer;
    }

    const transactionLink = `https://explorer.near.org/transactions/${action.tx_id}`;

    return {
      slug: collection.slug,
      title: nftMeta.name,
      rarity: nftMeta.rarity,
      ranking: nftMeta.ranking,
      price: `${Number(Number(action.list_price) / 1e24).toFixed(2)} NEAR`, // TODO: Round to USD also
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
    const { title, rarity, ranking, price, marketplaceLink, transactionLink, image } = data;

    const embed = new MessageEmbed().setColor(color);
    let attachments = [];

    const roundedRarity: number = rarity ? Math.round(rarity * 100) / 100 : 0;

    embed.setTitle(`${title} ${subTitle}`);
    if (marketplaceLink) {
      embed.setURL(marketplaceLink);
    }

    let description: string;
    description = `
      **Ranking**: ${ranking}
      **Rarity**: ${roundedRarity}
      **Price**: ${price}
    `
    if (data.buyer) description += `**Buyer**: ${data.buyer}\n`;
    if (data.seller) description += `**Seller**: ${data.seller}\n`

    embed.setDescription(description);

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
