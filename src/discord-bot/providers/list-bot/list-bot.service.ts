import { Injectable, Logger } from '@nestjs/common';
import { Once, InjectDiscordClient } from '@discord-nestjs/core';
import { AnyChannel, Channel, Client, MessageAttachment, MessageEmbed, TextChannel } from 'discord.js';
import { DiscordListDto } from 'src/discord-bot/dto/discord-list.dto';
import axios from 'axios';
import sharp from 'sharp';
import { BotHelperService } from '../bot-helper/bot-helper.service';
import { ChannelType } from 'discord-api-types/v10';

@Injectable()
export class ListBotService {
  private readonly logger = new Logger(ListBotService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
    private botHelperService: BotHelperService
  ) { }

  async send(data: DiscordListDto, server) {
    try {
      const { title, rarity, price, byzantionLink, transactionLink, image } = data;
      const byzFinalLink = this.botHelperService.enrichByzLink(byzantionLink, server.server_name);

      const embed = new MessageEmbed().setColor('YELLOW');
      let attachments = [];

      const roundedRarity: number = rarity ? Math.round(rarity * 100) / 100 : 0;

      embed.setTitle(`${title} has been listed for sale`);
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
      const channel = await this.client.channels.fetch(server.channel_id);

      if (channel.type === 'GUILD_TEXT') {
        await channel.send({
          embeds: [embed],
          files: attachments
        });
      } else {
        this.logger.warn('Not a valid text channel');
      }
    } catch (err) {
      this.logger.warn('Discord error', err);
    }
  }
}

