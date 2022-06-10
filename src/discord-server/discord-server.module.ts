import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DiscordServerController } from './discord-server.controller';
import { DiscordServerService } from './providers/discord-server.service';

@Module({
  imports: [PrismaModule],
  controllers: [DiscordServerController],
  providers: [DiscordServerService],
  exports: [DiscordServerService]
})
export class DiscordServerModule {}
