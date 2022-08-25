import { InjectDiscordClient } from "@discord-nestjs/core";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { Client, ColorResolvable, MessageAttachment, MessageEmbed } from "discord.js";
import * as sharp from "sharp";
import { DiscordBotDto } from "src/discord-bot/dto/discord-bot.dto";
import { Action } from "src/database/universal/entities/Action";
import { Collection } from "src/database/universal/entities/Collection";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { Repository } from "typeorm";
import { CryptoRateService } from "./crypto-rate.service";
import { Chain } from "src/database/universal/entities/Chain";

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
    private collectionRepository: Repository<Collection>
  ) {}

  createDiscordBotDto(action: Action): DiscordBotDto {
    const msc: SmartContract = action.marketplace_smart_contract;
    const sc: SmartContract = action.nft_meta.smart_contract;
    const chain: Chain = action.nft_meta.chain;

    // TODO: Use byzantion links for all chains when new marketplace is on production
    // i.e: `https://byzantion.xyz/collection/${action.collection.slug}/${action.nft_meta.token_id}`
    let marketplaceLink: string;
    let transactionLink: string;
    let sellerLink: string;
    let buyerLink: string;

    switch (chain.symbol) {
      case "Near":
        transactionLink = `https://explorer.near.org/transactions/${action.tx_id}`;
        if (sc && msc) {
          marketplaceLink =
            `https://byzantion.xyz/market-redirect` +
            `?base_marketplace_uri=${encodeURIComponent(msc.base_marketplace_uri)}` +
            `&token_uri=${encodeURIComponent(msc.token_uri)}` +
            `&contract_key=${sc.contract_key}` +
            `&token_id=${action.nft_meta.token_id}` +
            `&tx_link=${encodeURIComponent(transactionLink)}`;
        }
        if (action.buyer) buyerLink = `https://paras.id/${action.buyer}/collectibles`;
        if (action.seller) sellerLink = `https://paras.id/${action.seller}/collectibles`;
        break;

      case "Stacks":
        marketplaceLink = `https://byzantion.xyz/collection/${action.collection.slug}/${action.nft_meta.token_id}`;
        transactionLink = `https://explorer.stacks.co/txid/${action.tx_id}?chain=mainnet`;
        if (action.buyer) buyerLink = `https://byzantion.xyz/${action.buyer}`;
        if (action.seller) sellerLink = `https://byzantion.xyz/${action.seller}`;
        break;

      default:
        this.logger.warn(`Invalid chain symbol ${chain.symbol}`);
    }

    return {
      slug: action.collection.slug,
      title: action.nft_meta.name,
      rarity: action.nft_meta.rarity,
      ranking: action.nft_meta.ranking,
      collectionSize: action.collection.collection_size,
      price: Number(Number(action.list_price) / Number(Math.pow(10, chain.format_digits))),
      marketplace: msc.name,
      ...(marketplaceLink && { marketplaceLink }),
      transactionLink,
      ...(action.seller && { seller: action.seller }),
      ...(action.buyer && { buyer: action.buyer }),
      ...(action.seller && { sellerLink }),
      ...(action.buyer && { buyerLink }),
      image: action.nft_meta.image,
      cryptoCurrency: chain.coin,
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

  async buildMessage(data: DiscordBotDto, server_name: string, color: ColorResolvable, subTitle: string) {
    const { title, rarity, ranking, collectionSize, price, marketplaceLink, transactionLink, image, cryptoCurrency } =
      data;

    const embed = new MessageEmbed().setColor(color);
    let attachments = [];

    const roundedRarity: number = rarity ? Math.round(rarity * 100) / 100 : 0;

    embed.setTitle(`${title} ${subTitle}`);
    if (marketplaceLink) {
      embed.setURL(`${marketplaceLink}&server_name=${encodeURIComponent(server_name)}`);
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
      text: "Powered by Byzantion.xyz",
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
}
