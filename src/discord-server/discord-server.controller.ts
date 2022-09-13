import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Collection } from "src/database/universal/entities/Collection";
import { Repository } from "typeorm";
import { CreateDiscordServer } from "./interfaces/discord-server.dto";
import { FetchDiscordServerChannels } from "./interfaces/fetch-discord-server-channels.dto";
import { DiscordHelperService } from "./providers/discord-helper.service";
import { DiscordServerService } from "./providers/discord-server.service";

@Controller("api/discord-server")
export class DiscordServerController {
  private readonly logger = new Logger(DiscordServerController.name);

  constructor(
    private discordServerService: DiscordServerService,
    private discordHelper: DiscordHelperService,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>
  ) {}

  @Post("configure")
  @UsePipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, enableDebugMessages: true })
  )
  async loadServer(@Body() body: CreateDiscordServer) {
    const params = await this.validateAndTransform(body);
    await this.discordServerService.create(params);

    return "Ok";
  }

  @Get("channels")
  async fetchChannels(@Query() params: FetchDiscordServerChannels) {
    this.logger.debug(params);
    let subChannels = await this.discordServerService.getChannelsBySlug(params.slug, params.purpose);
    let uniChannels = await this.discordServerService.getUniversalChannels(params.marketplace, params.purpose, params.chainSymbol);
    const channels = subChannels.concat(uniChannels);

    this.logger.log("Channels ");
    for (let channel of channels) {
      this.logger.log(channel);
    }
    return channels;
  }

  async validateAndTransform(params: CreateDiscordServer): Promise<CreateDiscordServer> {
    for (let ch of params.channels) {
      let collectionIds = [];
      let result = await this.discordHelper.isChannelOnServer(ch.channel_id, params.server_id);
      if (!result.server_exists) {
        throw new HttpException(`Discord server does not exists: "${params.server_id}"`, HttpStatus.BAD_REQUEST);
      }
      if (!result.channel_in_server) {
        throw new HttpException(
          `Channel: "${ch.channel_id}" is not in discord server: ${params.server_id}`,
          HttpStatus.BAD_REQUEST
        );
      }

      for (let slug of ch.collections) {
        // TODO: Move to collection service
        let collection = await this.collectionRepository.findOneBy({ slug });
        if (!collection) {
          throw new HttpException(`Unable to find this collection: "${slug}"`, HttpStatus.BAD_REQUEST);
        }
        collectionIds.push(collection.id);
      }
      ch.collections = collectionIds;
    }

    return params;
  }
}
