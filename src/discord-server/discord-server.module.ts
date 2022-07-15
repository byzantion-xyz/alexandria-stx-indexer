import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { DiscordServerController } from "./discord-server.controller";
import { DiscordServerService } from "./providers/discord-server.service";
import { DiscordHelperService } from "./providers/discord-helper.service";
import { DiscordModule } from "@discord-nestjs/core";
import { ApikeyMiddleware } from "src/common/middleware/apikey.middleware";
import { DiscordServerChannel } from "src/database/universal/entities/DiscordServerChannel";
import { Collection } from "src/database/universal/entities/Collection";
import { DiscordServer } from "src/database/universal/entities/DiscordServer";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CollectionOnDiscordServerChannel } from "src/database/universal/entities/CollectionOnDiscordServerChannel";

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([Collection, DiscordServer, DiscordServerChannel, CollectionOnDiscordServerChannel]),
  ],
  controllers: [DiscordServerController],
  providers: [DiscordServerService, DiscordHelperService],
  exports: [DiscordServerService],
})
export class DiscordServerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApikeyMiddleware).forRoutes({ path: "api/discord-server/configure", method: RequestMethod.POST });
  }
}
