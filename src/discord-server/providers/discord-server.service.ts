import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { channel } from "diagnostics_channel";
import { Collection } from "src/database/universal/entities/Collection";
import { CollectionOnDiscordServerChannel } from "src/database/universal/entities/CollectionOnDiscordServerChannel";
import { DiscordServer } from "src/database/universal/entities/DiscordServer";
import { DiscordServerChannel } from "src/database/universal/entities/DiscordServerChannel";
import { DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";
import { RelationId, Repository } from "typeorm";
import { CreateDiscordServer, CreateDiscordServerChannel } from "../interfaces/discord-server.dto";

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
    let discordServer = await this.discordServerRepository.findOne({
      where: { server_id: params.server_id },
      relations: { discord_server_channels: { collection_on_discord_server_channels: true } },
    });

    if (discordServer) {
      for (let ch of discordServer.discord_server_channels) {
        await this.collectionOnDiscordServerChannelRepository.delete({ discord_server_channel_id: ch.id });
        await this.discordServerChannelRepository.delete({ id: ch.id });
      }
    } else {
      discordServer = this.discordServerRepository.create({
        server_id: params.server_id,
        server_name: params.server_name,
        active: true
      });
    }

    discordServer.discord_server_channels = this.discordServerChannelRepository.create(params.channels.map((ch) => ({
        channel_id: ch.channel_id,
        name: ch.name,
        purpose: ch.purpose,
        collection_on_discord_server_channels: ch.collections.map((collection_id) => ({ collection_id })),
      })),
    );

    await this.discordServerRepository.save(discordServer, { transaction: true });
  }

  async fetchChannelsBySlug(slug: string, purpose: DiscordChannelType) {
    const channels = await this.discordServerChannelRepository.find({
      where: {
        collection_on_discord_server_channels: {
          collection: { slug },
        },
        purpose: purpose,
        discord_server: { active: true },
      },
      relations: { discord_server: true },
    });

    return channels;
  }
}
