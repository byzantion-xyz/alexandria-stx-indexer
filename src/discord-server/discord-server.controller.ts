import { Body, Controller, Get, HttpException, HttpStatus, Logger, Param, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { DiscordChannelType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDiscordServer } from './interfaces/discord-server.dto';
import { fetchDiscordServerChannels } from './interfaces/fetch-discord-server-channels.dto'
import { DiscordServerService } from './providers/discord-server.service';

@Controller('api/discord-server')
export class DiscordServerController {
  private readonly logger = new Logger(DiscordServerController.name);

  constructor(
    private discordServerService: DiscordServerService,
    private readonly prisma: PrismaService
  ) { }

  @Post('configure')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, enableDebugMessages: true }))
  async loadServer(@Body() body: CreateDiscordServer) {
    this.logger.log(JSON.stringify(body, null, 2));
    // TODO: Verify server id
    // TODO: Verify channel id and channel in server

    // Check that collection slug is found and transform to ids.
    let collectionIds = [];
    for (let ch of body.channels) {
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
