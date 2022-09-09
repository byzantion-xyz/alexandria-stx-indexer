import {
  Logger,
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Once, InjectDiscordClient } from "@discord-nestjs/core";
import { Client } from "discord.js";
import { BotHelperService } from "./providers/bot-helper.service";
import { DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";

@Controller("api/discord-bot")
export class DiscordBotController {
  private readonly logger = new Logger(DiscordBotController.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private botHelperService: BotHelperService
  ) {}

  // FOR TESTING
  @Post("test")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUniversalChannels(@Body() params: { market_name: string, purpose: DiscordChannelType }) {

    const res = await this.botHelperService.getUniversalChannels(params.market_name, params.purpose);
    return res;
  }

  /*@Post("listing")
  @UsePipes(new ValidationPipe({ transform: true }))
  async postListing(@Body() listing: DiscordBotDto) {
    if (process.env.NODE_ENV === "production") {
      return "Endpoint disabled for production";
    }

    await this.listBotService.send(listing);
    return "Ok";
  }*/

  /*@Post("sale")
  @UsePipes(new ValidationPipe({ transform: true }))
  async postSale(@Body() sale: DiscordBotDto) {
    if (process.env.NODE_ENV === "production") {
      return "Endpoint disabled for production";
    }

    await this.saleBotService.send(sale);
    return "Ok";
  }*/

  /* For testing purposes */
  @Post("action")
  @UsePipes(new ValidationPipe({ transform: true }))
  async postAction(@Body() params: { actionId: string }) {
    if (process.env.NODE_ENV === "production") {
      return "Endpoint disabled for production";
    }
    const action = await this.botHelperService.fetchActionData(params.actionId);
    if (!action) {
      throw new HttpException("Action not found", HttpStatus.BAD_REQUEST);
    }
    const data = await this.botHelperService.createDiscordBotDto(action);

    await this.botHelperService.send(data);
    return data;
  }

  // Feature module must wait until discord client is logged in
  @Once("ready")
  onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started!`);
  }
}
