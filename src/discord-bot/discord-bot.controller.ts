import { Injectable, Logger, Controller, Post, Body, UsePipes, ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { Once, InjectDiscordClient } from '@discord-nestjs/core';
import { Client } from 'discord.js';
import { DiscordBotDto } from './dto/discord-bot.dto'; 
import { ListBotService } from './providers/list-bot.service';
import { SalesBotService } from './providers/sales-bot.service';
import { BotHelperService } from './providers/bot-helper.service';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { Action } from 'rxjs/internal/scheduler/Action';

@Controller('api/discord-bot')
export class DiscordBotController {
  private readonly logger = new Logger(DiscordBotController.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private botHelperService: BotHelperService,
    private listBotService: ListBotService,
    private saleBotService: SalesBotService
  ) { }

  @Post('listing')
  @UsePipes(new ValidationPipe({ transform: true }))
  async postListing(@Body() listing: DiscordBotDto) {
    if (process.env.NODE_ENV === 'production') {
      return 'Endpoint disabled for production';
    }
   
    await this.listBotService.send(listing);
    return 'Ok';
  }

  @Post('sale')
  @UsePipes(new ValidationPipe({ transform: true }))
  async postSale(@Body() sale: DiscordBotDto) {
    if (process.env.NODE_ENV === 'production') {
      return 'Endpoint disabled for production';
    }
   
    await this.saleBotService.send(sale);
    return 'Ok';
  }

  /* For testing purposes */
  @Post('action')
  @UsePipes(new ValidationPipe({ transform: true }))
  async postAction(@Body() params: { actionId: string, purpose: string }) {
    if (process.env.NODE_ENV === 'production') {
      return 'Endpoint disabled for production';
    }
    const action = await this.botHelperService.fetchActionData(params.actionId);
    if (!action) {
      throw new HttpException('Action not found', HttpStatus.BAD_REQUEST);   
    }
    const data = await this.botHelperService.createDiscordBotDto(action);

    if (action.action === ActionName.buy) {
      await this.saleBotService.send(data);
    } else if (action.action === ActionName.list) {
      await this.listBotService.send(data);
    }
    return 'Ok';
  }

  // Feature module must wait until discord client is logged in
  @Once('ready')
  onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started!`);
  }

}
