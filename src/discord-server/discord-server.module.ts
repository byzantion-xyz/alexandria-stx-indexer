import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DiscordServerController } from './discord-server.controller';
import { DiscordServerService } from './providers/discord-server.service';
import { DiscordHelperService } from './providers/discord-helper.service';
import { DiscordModule } from '@discord-nestjs/core';
import { ApikeyMiddleware } from 'src/common/middlewares/apikey.middleware';
import { DiscordServerChannel } from 'src/entities/DiscordServerChannel';
import { Collection } from 'src/entities/Collection';
import { DiscordServer } from 'src/entities/DiscordServer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionOnDiscordServerChannel } from 'src/entities/CollectionOnDiscordServerChannel';

@Module({
  imports: [
    PrismaModule, 
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([Collection, DiscordServer, DiscordServerChannel, CollectionOnDiscordServerChannel])
  ],  
  controllers: [DiscordServerController],
  providers: [DiscordServerService, DiscordHelperService],
  exports: [DiscordServerService]
})
export class DiscordServerModule implements NestModule {

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApikeyMiddleware)
      .forRoutes({ path: 'api/discord-server/configure', method: RequestMethod.POST });
  }

}
