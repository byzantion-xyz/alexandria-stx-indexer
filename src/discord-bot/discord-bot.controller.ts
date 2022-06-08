import { Injectable, Logger, Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { Once, InjectDiscordClient } from '@discord-nestjs/core';
import { Client } from 'discord.js';
import { DiscordBotDto } from './dto/discord-bot.dto'; 
import { ListBotService } from './providers/list-bot.service';
import { SalesBotService } from './providers/sales-bot.service';

@Controller('discord-bot')
export class DiscordBotController {
  private readonly logger = new Logger(DiscordBotController.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private listBotService: ListBotService,
    private saleBotService: SalesBotService
  ) { }

  @Post('listing')
  @UsePipes(new ValidationPipe({ transform: true }))
  async postListing(@Body() listing: DiscordBotDto) {
   
    this.listBotService.send(listing);
  }

  @Post('sale')
  @UsePipes(new ValidationPipe({ transform: true }))
  async postSale(@Body() sale: DiscordBotDto) {

    this.saleBotService.send(sale);
  }

  // Feature module must wait until discord client is logged in
  @Once('ready')
  onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started!`);
  }

}
