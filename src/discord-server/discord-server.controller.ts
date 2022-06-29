import { Body, Controller, Get, HttpException, HttpStatus, Logger, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { DiscordChannelType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDiscordServer } from './interfaces/discord-server.dto';
import { fetchDiscordServerChannels } from './interfaces/fetch-discord-server-channels.dto'
import { DiscordHelperService } from './providers/discord-helper.service';
import { DiscordServerService } from './providers/discord-server.service';

@Controller('api/discord-server')
export class DiscordServerController {
  private readonly logger = new Logger(DiscordServerController.name);

  constructor(
    private discordServerService: DiscordServerService,
    private discordHelper: DiscordHelperService,
    private readonly prisma: PrismaService
  ) { }

  @Post('configure')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, enableDebugMessages: true }))
  async loadServer(@Body() body: CreateDiscordServer) {
    let collectionIds = [];
    for (let ch of body.channels) {
      let result = await this.discordHelper.isChannelOnServer(ch.channel_id, body.server_id);
      if (!result.server_exists) {
        throw new HttpException(`Discord server does not exists: "${body.server_id}"`, HttpStatus.BAD_REQUEST);
      }
      if (!result.channel_in_server) {
        throw new HttpException(`Channel: "${ch.channel_id}" is not in discord server: ${body.server_id}`, HttpStatus.BAD_REQUEST);        
      }

      for (let slug of ch.collections) {
        let collection = await this.prisma.collection.findUnique({ where: { slug }});
        if (!collection) {
          throw new HttpException(`Unable to find this collection: "${slug}"`, HttpStatus.BAD_REQUEST);
        }
        collectionIds.push(collection.id);
      }
      ch.collections = collectionIds;
    }

    await this.discordServerService.create(body);

    return 'Ok';
  }

  @Get('channels')
  async fetchChannels(@Query() params: fetchDiscordServerChannels) {
    this.logger.debug(params);
    let channels = await this.discordServerService.fetchChannelsBySlug(params.slug, params.purpose);
    this.logger.log('Channels ');
    for (let channel of channels) {
      this.logger.log(channel);
    }
    return 'Ok';
  }

}
