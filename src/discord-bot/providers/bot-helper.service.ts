import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Client, ColorResolvable, MessageAttachment, MessageEmbed } from 'discord.js';
import * as sharp from 'sharp';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';

@Injectable()
export class BotHelperService {
  private readonly logger = new Logger(BotHelperService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
  ) { }

  enrichByzLink(byzLink: string, server_name: string): string {
    return encodeURI(`${byzLink}?utm_source=byzantion_bot&utm_medium=${server_name}`);
  };

  async sendMessage(message, server) {
    const channel = await this.client.channels.fetch(server.channel_id);

    if (channel.type === 'GUILD_TEXT') {
      await channel.send(message);
    } else {
      this.logger.warn('Not a valid text channel');
    }
  }

  async buildMessage(data: DiscordBotDto, server, color: ColorResolvable, subTitle: string) {
    const { title, rarity, price, byzantionLink, transactionLink, image } = data;
    
    const byzFinalLink = this.enrichByzLink(byzantionLink, server.server_name);
    const embed = new MessageEmbed().setColor(color);
    let attachments = [];

    const roundedRarity: number = rarity ? Math.round(rarity * 100) / 100 : 0;

    embed.setTitle(`${title} ${subTitle}`);
    embed.setURL(byzFinalLink);
    embed.setDescription(`**Rarity**: ${roundedRarity}\n**Price**: ${price}`);
    embed.addField('Attributes', `[View](${byzFinalLink})`, true);
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

}
