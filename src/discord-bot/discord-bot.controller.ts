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
    // TODO: Use provider to fetch channel and server data from contract_key
    const server = { channel_id: '948998237040283709', server_name: 'Byzantion test' };
    this.listBotService.send(listing, server);
  }

  @Post('sale')
  @UsePipes(new ValidationPipe({ transform: true }))
  async postSale(@Body() sale: DiscordBotDto) {
    // TODO: Use provider to fetch channel and server data from contract_key
    const server = { channel_id: '948998237040283709', server_name: 'Byzantion test' };

    this.saleBotService.send(sale, server);
  }

  // Feature module must wait until discord client is logged in
  @Once('ready')
  onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started!`);
  }

}
