import { Injectable, Logger } from '@nestjs/common';
import { DiscordChannelType } from '@prisma/client';
import { channel } from 'diagnostics_channel';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDiscordServer, CreateDiscordServerChannel } from '../interfaces/discord-server.dto';

@Injectable()
export class DiscordServerService {
  private readonly logger = new Logger(DiscordServerService.name);

  constructor(
    private readonly prisma: PrismaService
  ) { }

  async create(params: CreateDiscordServer) {
    let channels: CreateDiscordServerChannel[] = [];

    if (params.channels && params.channels.length) {
      for (let ch of params.channels) {
        channels.push({
          channel_id: ch.channel_id,
          name: ch.name,
          purpose: ch.purpose,
          collections: ch.collections
        })
      }
    }

    await this.prisma.discordServer.create({
      data: {
        server_id: params.server_id,
        server_name: params.server_name,
        ...(channels && channels.length && { discord_server_channels: { create: channels }})
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
