import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DiscordServerController } from './discord-server.controller';
import { DiscordServerService } from './providers/discord-server.service';
import { DiscordHelperService } from './providers/discord-helper.service';
import { DiscordModule } from '@discord-nestjs/core';

@Module({
  imports: [
    PrismaModule, 
    DiscordModule.forFeature()
  ],  
  controllers: [DiscordServerController],
  providers: [DiscordServerService, DiscordHelperService],
  exports: [DiscordServerService]
})
export class DiscordServerModule {}
