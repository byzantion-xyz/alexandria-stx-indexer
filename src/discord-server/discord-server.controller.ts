import { Body, Controller, Get, Logger, Param, Post, Query } from '@nestjs/common';
import { DiscordChannelType } from '@prisma/client';
import { createDiscordServer } from './dto/discord-server.dto';
import { fetchDiscordServerChannels } from './dto/fetch-discord-server-channels.dto'
import { DiscordServerService } from './providers/discord-server.service';

@Controller('discord-server')
export class DiscordServerController {
  private readonly logger = new Logger(DiscordServerController.name);

  constructor(
    private discordServerService: DiscordServerService
  ) { }

  @Post()
  async loadServer(@Body() params: createDiscordServer) {

    /* Body example */
    /*let params: createDiscordServer = {
      server_id: BigInt(927712532276314122),
      server_name: 'Byzantion test server',
      active: true,
      discord_server_channels: [{
        channel_id: BigInt(948998237040283709),
        name: 'Test channel',
        purpose: DiscordChannelType.listings,
      }, {
        channel_id: BigInt(940931607165009940),
        name: 'Some channel',
        purpose: DiscordChannelType.sales,
      }]
    };*/

    this.discordServerService.create(params);

    return 'Ok';
  }

  @Get('channels')
  async fetchChannels(@Query() params: fetchDiscordServerChannels) {
    this.logger.debug(params);
    let channels = await this.discordServerService.fetchChannelsByContractKey(params.contract_key, params.purpose);
    this.logger.log('Channels ', channels);
    return 'Ok';
  }

}
