import { InjectDiscordClient } from "@discord-nestjs/core";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { Client, ColorResolvable, MessageAttachment, MessageEmbed } from "discord.js";
import * as sharp from "sharp";
import { DiscordBotDto } from "src/discord-bot/dto/discord-bot.dto";
import { Action } from "src/database/universal/entities/Action";
import { Collection } from "src/database/universal/entities/Collection";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { Repository } from "typeorm";
import { CryptoRateService } from "./crypto-rate.service";
import { Chain } from "src/database/universal/entities/Chain";
import { ActionName, DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";
import { DiscordServerService } from "src/discord-server/providers/discord-server.service";
import { ActionOption, actionOptions } from "../interfaces/action-option.interface";

const FIAT_CURRENCY = "USD";

@Injectable()
export class BotHelperService {
  private readonly logger = new Logger(BotHelperService.name);

  constructor(
    @InjectDiscordClient() private client: Client,
    private readonly cryptoRateService: CryptoRateService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    private discordServerSvc: DiscordServerService
  ) {}

  createDiscordBotDto(action: Action): DiscordBotDto {
    const msc: SmartContract = action.marketplace_smart_contract;
    const sc: SmartContract = action.nft_meta.smart_contract;
    const chain: Chain = action.nft_meta.chain;
    const slug: string = action.collection?.slug;

    // TODO: Use tradeport links for all chains when new marketplace is on production
    // i.e: `https://tradeport.xyz/collection/${action.collection.slug}/${action.nft_meta.token_id}`
    let marketplaceLink: string;
    let transactionLink: string;
    let sellerLink: string;
    let buyerLink: string;

    switch (chain.symbol) {
      case "Near":
        transactionLink = `https://explorer.near.org/receipts/${action.tx_id}`;
        if (sc && msc) {
          if (msc.base_marketplace_uri.includes("fewfar")) {
            marketplaceLink =
              `https://tradeport.xyz/market-redirect` +
              `?base_marketplace_uri=${encodeURIComponent(msc.base_marketplace_uri)}` +
              `&token_uri=${encodeURIComponent(msc.token_uri)}` +
              `&contract_key=${sc.contract_key}` +
              `&token_id=${action.nft_meta.token_id}` +
              `&tx_link=${encodeURIComponent(transactionLink)}`;
          } else {
            marketplaceLink = `https://tradeport.xyz/collection/${slug}/${action.nft_meta.token_id}?utm_source=byzantion_bot&slug=${slug}&action=${action.action}`;
            if (action.buyer) buyerLink = `${msc.base_marketplace_uri}/${action.buyer}`;
            if (action.seller) sellerLink = `${msc.base_marketplace_uri}/${action.seller}`;
          }
        }
        break;

      case "Stacks":
        marketplaceLink = `https://tradeport.xyz/collection/${action.collection.slug}/${action.nft_meta.token_id}`;
        transactionLink = `https://explorer.stacks.co/txid/${action.tx_id}?chain=mainnet`;
        if (action.buyer) buyerLink = `https://tradeport.xyz/${action.buyer}`;
        if (action.seller) sellerLink = `https://tradeport.xyz/${action.seller}`;
        break;

      default:
        this.logger.warn(`Invalid chain symbol ${chain.symbol}`);
    }

    const purpose = actionOptions[action.action].purpose;
    const price = purpose === DiscordChannelType.bids ? action.bid_price : action.list_price;

    return {
      slug: action.collection.slug,
      title: action.nft_meta.name,
      rarity: action.nft_meta.rarity,
      ranking: action.nft_meta.ranking,
      collectionSize: action.collection.collection_size,
      price: Number(Number(price) / Number(Math.pow(10, chain.format_digits))),
      marketplace: msc.name,
      ...(marketplaceLink && { marketplaceLink }),
      transactionLink,
      ...(action.seller && { seller: action.seller }),
      ...(action.buyer && { buyer: action.buyer }),
      ...(action.seller && { sellerLink }),
      ...(action.buyer && { buyerLink }),
      image: action.nft_meta.image,
      cryptoCurrency: chain.coin,
      action_name: action.action
    };
  }

  async sendMessage(message, channel_id: string) {
    const channel = await this.client.channels.fetch(channel_id);
    
    if (channel.type === "GUILD_TEXT" && process.env.NODE_ENV === "production") {
      await channel.send(message);
    } else {
      this.logger.warn("Not a valid text channel");
    }
  }

  async buildMessage(data: DiscordBotDto, server_name: string, options: ActionOption) {
    const { title, rarity, ranking, collectionSize, price, marketplaceLink, transactionLink, image, cryptoCurrency } =
      data;

    const embed = new MessageEmbed().setColor(options.color);
    let attachments = [];

    const roundedRarity: number = rarity ? Math.round(rarity * 100) / 100 : 0;

    embed.setTitle(`${options.titlePrefix} ${title} ${options.titleSuffix}`);
    if (marketplaceLink) {
      embed.setURL(`${marketplaceLink}&discord_server=${encodeURIComponent(server_name)}`);
      // embed.setURL(marketplaceLink);
    }

    // TODO: Add support for chain tokens (i.e banana in stacks)
    const priceInFiat = await this.cryptoRateService.cryptoToFiat(price, cryptoCurrency, FIAT_CURRENCY);

    embed.setDescription(`
      **Rarity Ranking**: ${ranking}/${collectionSize}
      **Rarity Score**: ${roundedRarity}
      **Price**: ${Number(price).toFixed(2)} ${cryptoCurrency} ($${priceInFiat} ${FIAT_CURRENCY})
    `);

    let seller: string;
    if (data.seller) {
      seller = data.seller;
      if (data.seller && data.seller.length > 20) seller = data.seller.slice(0, 5) + "..." + data.seller.slice(-5);
    }

    let buyer: string;
    if (data.buyer) {
      buyer = data.buyer;
      if (data.buyer && data.buyer.length > 20) buyer = data.buyer.slice(0, 5) + "..." + data.buyer.slice(-5);
    }

    if (seller) embed.addField(`Seller`, `[${seller}](${data.sellerLink})`, true);
    if (buyer) embed.addField(`Buyer`, `[${buyer}](${data.buyerLink})`, true);
    if (transactionLink) embed.addField("Transaction", `[View](${transactionLink})`, true);

    if (image) {
      try {
        const imgData = await axios.get(image, { responseType: "arraybuffer" });
        const imageBuffer = Buffer.from(imgData.data, "binary");
        const resizedBuffer = await sharp(imageBuffer).resize(1024, 1024, { fit: "inside" }).toBuffer();

        const imgTitle = image.split("/")[image.split("/").length - 1];
        const withEnding = imgTitle.includes(".") ? imgTitle : `${imgTitle}.png`;
        attachments.push(new MessageAttachment(resizedBuffer, withEnding));

        embed.setImage(`attachment://${withEnding}`);
      } catch (err) {
        console.error(err);
      }
    }

    if (embed.video) attachments = []; // Do not include video files
    embed.setTimestamp();

    embed.setFooter({
      text: "powered by Byzantion",
      iconURL: "https://res.cloudinary.com/daxts7gzz/image/upload/v1656619671/byz-logo-2.webp",
    });

    return { embeds: [embed], files: attachments };
  }

  async fetchActionData(actionId: string): Promise<Action> {
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
      relations: {
        nft_meta: { nft_state: true, smart_contract: true, chain: true },
        collection: true,
        marketplace_smart_contract: true,
      },
    });

    return action;
  }

  async send(data: DiscordBotDto) {
    try {
      const options: ActionOption = actionOptions.find(ac => ac.name === data.action_name);
      if (!options) return;
      
      //this.logger.log('send() options: ', { options });
      const subChannels = await this.discordServerSvc.getChannelsBySlug(data.slug, options.purpose);
      const uniChannels = await this.discordServerSvc.getUniversalChannels(data.marketplace, options.purpose);
      const channels = subChannels.concat(uniChannels);
      //this.logger.log('send() channels: ', { channels });
      
      //let messageContent = await this.buildMessage(data, 'test server', options);
      //this.logger.log('sendMessage() message: ', { messageContent });

      if (!channels || !channels.length) return;

      for (let channel of channels) {
        let messageContent = await this.buildMessage(data, channel.discord_server.server_name, options);

        await this.sendMessage(messageContent, channel.channel_id);
      }
    } catch (err) {
      this.logger.warn("Discord error", err);
    }
  }

  async createAndSend(actionId: string) {
    const action = await this.fetchActionData(actionId);
    const data = await this.createDiscordBotDto(action);

    await this.send(data);
  }

  async getUniversalChannels() {
    //CHANGE 'byzantion' TO OTHER MARKET FOR TESTING
    const res = await this.discordServerSvc.getUniversalChannels('apollo', DiscordChannelType.listings)
    return res;
  }
}
