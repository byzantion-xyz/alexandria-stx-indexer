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
import { FetchUniversalChannels } from "src/discord-server/interfaces/fetch-universal-channels.interface";

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
  async getUniversalChannels(@Body() params: FetchUniversalChannels) {
    const { marketplace, purpose, chainId } = params;
    const res = await this.botHelperService.getUniversalChannels(marketplace, purpose, chainId);
    return res;
  }

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
