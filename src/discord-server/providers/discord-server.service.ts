import { Injectable, Logger } from '@nestjs/common';
import { DiscordChannelType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { createDiscordServer } from '../dto/discord-server.dto';

@Injectable()
export class DiscordServerService {
  private readonly logger = new Logger(DiscordServerService.name);

  constructor(
    private readonly prisma: PrismaService
  ) { }

  async create(params: createDiscordServer) {
    let discordServerChannels = [];

    if (params.discord_server_channels && params.discord_server_channels.length) {
      discordServerChannels = params.discord_server_channels;
    }

    await this.prisma.discordServer.create({
      data: {
        server_id: params.server_id,
        server_name: params.server_name,
        active: params.active,
        ...(params.discord_server_channels && {
          discord_server_channels: {
            create: discordServerChannels
          }
        })
      }
    });
  }

  async fetchChannelsBySlug(slug: string, purpose: DiscordChannelType) {
    let collection = await this.prisma.collection.findUnique({ where: { slug } });
    let channels;
    if (collection) {
      channels = await this.prisma.discordServerChannel.findMany({
        where: { 
          collections: {
            some: { collection_id: collection.id }
          },
          purpose: purpose,
          discord_server: {
            active: true
          }
        },
        include: { 
          discord_server: true
        }
      });
    }
    
    return channels;
  }
}
