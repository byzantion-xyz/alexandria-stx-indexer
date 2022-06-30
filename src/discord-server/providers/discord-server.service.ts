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

    const discordServer = await this.prisma.discordServer.findUnique({ where: { server_id: params.server_id }});
    if (discordServer) {
      await this.prisma.discordServerChannel.deleteMany({ where: { discord_server_id: discordServer.id }});
      await this.prisma.discordServer.delete({ 
        where: { server_id: params.server_id }
      });
    }

    const discord_server_channels = params.channels.map(ch => {
      return {
        channel_id: ch.channel_id,
        name: ch.name,
        purpose: ch.purpose,
        collections: { create: [{ collection: { connect: { id: ch.collections[0]} }}]}
      };
    });

    await this.prisma.discordServer.create({
      data: {
        server_id: params.server_id,
        server_name: params.server_name,
        discord_server_channels: { create: discord_server_channels } 
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
