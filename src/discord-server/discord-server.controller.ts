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
  async loadServer(@Body() body: createDiscordServer) {
     /* Body example */
    /*let params: createDiscordServer = {
      server_id: "933254508878901319",
      server_name: 'NEAR Ocean',
      active: false,
      discord_server_channels: [{
        channel_id: "987048128542814288",
        name: 'sales-and-listings',
        purpose: DiscordChannelType.listings,
      }, {
        channel_id: "987048128542814288",
        name: 'sales-and-listings',
        purpose: DiscordChannelType.sales,
      }]
    };*/
   
    this.discordServerService.create(body);

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
