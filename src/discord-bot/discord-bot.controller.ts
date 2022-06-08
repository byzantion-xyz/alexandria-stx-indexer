import { Injectable, Logger, Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { Once, InjectDiscordClient } from '@discord-nestjs/core';
import { Client } from 'discord.js';
import { DiscordListDto } from './dto/discord-list.dto'; 
import { ListBotService } from './providers/list-bot/list-bot.service';

@Controller('discord-bot')
export class DiscordBotController {
  private readonly logger = new Logger(DiscordBotController.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private listBotService: ListBotService
  ) { }

  @Post('listing')
  @UsePipes(new ValidationPipe({ transform: true }))
  async postListing(@Body() listing: DiscordListDto) {
    // TODO: Use provider to fetch channel and server data from contract_key
    const server = { channel_id: '948998237040283709', server_name: 'Byzantion test' };
    this.listBotService.send(listing, server);
  }

  @Once('ready')
  onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started!`);
  }

}
