import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { CollectionOnDiscordServerChannel } from "src/database/universal/entities/CollectionOnDiscordServerChannel";
import { DiscordServer } from "src/database/universal/entities/DiscordServer";
import { DiscordServerChannel } from "src/database/universal/entities/DiscordServerChannel";
import { DiscordChannelType } from "src/indexers/common/helpers/indexer-enums";
import { In, Repository, IsNull, Any } from "typeorm";
import { CreateDiscordServer } from "../interfaces/discord-server.dto";
import { UniversalServerDTO } from "../interfaces/universal-server.dto";

@Injectable()
export class DiscordServerService {
  private readonly logger = new Logger(DiscordServerService.name);

  constructor(
    @InjectRepository(DiscordServerChannel)
    private discordServerChannelRepository: Repository<DiscordServerChannel>,
    @InjectRepository(DiscordServer)
    private discordServerRepository: Repository<DiscordServer>,
    @InjectRepository(CollectionOnDiscordServerChannel)
    private collectionOnDiscordServerChannelRepository: Repository<CollectionOnDiscordServerChannel>,
    private config: ConfigService
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
      discordServer.server_name = params.server_name;
    } else {
      discordServer = this.discordServerRepository.create({
        server_id: params.server_id,
        server_name: params.server_name,
        active: true,
      });
    }

    discordServer.discord_server_channels = this.discordServerChannelRepository.create(
      params.channels.map((ch) => ({
        channel_id: ch.channel_id,
        name: ch.name,
        purpose: ch.purpose,
        collection_on_discord_server_channels: ch.collections.map((collection_id) => ({ collection_id })),
      }))
    );

    await this.discordServerRepository.save(discordServer, { transaction: true });
  }

  async getChannelsBySlug(slug: string, purpose: DiscordChannelType) {
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

  async getUniversalChannels(marketplace: string, purpose: DiscordChannelType, chainId: string) {
    if (!marketplace) return [];

    const universalServers: Array<UniversalServerDTO> = this.config.get("discord.universalServers");
    const server_ids = universalServers
      .filter((s) => s.marketplace_name.includes(marketplace) || s.marketplace_name.includes('all'))
      .map(s => s.server_id);

    if (server_ids) {
      const channels = await this.discordServerChannelRepository.find({
        where: [
          { purpose: purpose, discord_server: { active: true, server_id: In(server_ids) }, chain_id: IsNull() },
          { purpose: purpose, discord_server: { active: true, server_id: In(server_ids) }, chain_id: chainId },
        ],
        relations: { discord_server: true },
      });

      return channels;
    }

    return [];
  }
}
