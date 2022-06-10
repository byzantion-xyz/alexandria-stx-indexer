import { Module } from '@nestjs/common';
import { DiscordServerController } from './discord-server.controller';
import { DiscordServerService } from './providers/discord-server.service';

@Module({
  controllers: [DiscordServerController],
  providers: [DiscordServerService],
  exports: [DiscordServerService]
})
export class DiscordServerModule {}
