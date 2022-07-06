import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { channel } from "diagnostics_channel";
import { Collection } from "src/entities/Collection";
import { CollectionOnDiscordServerChannel } from "src/entities/CollectionOnDiscordServerChannel";
import { DiscordServer } from "src/entities/DiscordServer";
import { DiscordServerChannel } from "src/entities/DiscordServerChannel";
import { DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";
import { RelationId, Repository } from "typeorm";
import {
  CreateDiscordServer,
  CreateDiscordServerChannel,
} from "../interfaces/discord-server.dto";

@Injectable()
export class DiscordServerService {
  private readonly logger = new Logger(DiscordServerService.name);

  constructor(
    @InjectRepository(DiscordServerChannel)
    private discordServerChannelRepository: Repository<DiscordServerChannel>,
    @InjectRepository(DiscordServer)
    private discordServerRepository: Repository<DiscordServer>,
    @InjectRepository(CollectionOnDiscordServerChannel)
    private collectionOnDiscordServerChannelRepository: Repository<CollectionOnDiscordServerChannel>
  ) {}

  async create(params: CreateDiscordServer) {
    const discordServer = await this.discordServerRepository.findOne({
      where: { server_id: params.server_id},
      relations: { discord_server_channels: { collection_on_discord_server_channels: true } },
    });

    if (discordServer) {
      for (let ch of discordServer.discord_server_channels) {
        await this.collectionOnDiscordServerChannelRepository.delete({ discord_server_channel_id: ch.id });
        await this.discordServerChannelRepository.delete({ id: ch.id });
      }
      await this.discordServerRepository.remove(discordServer);
    }

    const discord_server_channels = params.channels.map((ch) => {
      return {
        channel_id: ch.channel_id,
        name: ch.name,
        purpose: ch.purpose,
        /*collections: {
          create: ch.collections.map((collectionId) => ({
            collection: { connect: { id: collectionId } },
          })),
        },*/
      };
    });

    const discordServerObj = this.discordServerRepository.create({
      server_id: params.server_id,
      server_name: params.server_name,
      active: true
    });

    const discordServerChannel = this.discordServerChannelRepository.create(discord_server_channels[0]);
    discordServerObj.discord_server_channels.push(discordServerChannel);

    const saved = await this.discordServerRepository.save(discordServerObj);
  }

  async fetchChannelsBySlug(slug: string, purpose: DiscordChannelType) {
    const channels = await this.discordServerChannelRepository.find({
      where: {
        collection_on_discord_server_channels: {
          collection: { slug },
        },
        purpose: purpose,
        discord_server: { active: true }
      },
      relations: { discord_server: true },
    });

    return channels;
  }
}
