import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { NearScraperController } from "./near-scraper/near-scraper.controller";
import { NearScraperService } from "./near-scraper/near-scraper.service";
import { IpfsHelperService } from "./providers/ipfs-helper.service";
import { MissingCollectionService } from "./near-scraper/providers/missing-collection.service";
import { ContractConnectionService } from "./near-scraper/providers/contract-connection-service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { DbHelperService } from "./common/db-helper/db-helper.service";
import { Collection } from "src/database/universal/entities/Collection";
import { CollectionScrape } from "src/database/universal/entities/CollectionScrape";
import { CollectionCreator } from "src/database/universal/entities/CollectionCreator";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { NftMetaAttribute } from "src/database/universal/entities/NftMetaAttribute";
import { CollectionAttribute } from "src/database/universal/entities/CollectionAttribute";
import { ApiProtectMiddleware } from "src/common/middleware/apiprotect.middleware";
import { ApiKey } from "src/database/universal/entities/ApiKey";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SmartContract,
      Collection,
      CollectionAttribute,
      CollectionScrape,
      CollectionCreator,
      NftMeta,
      NftMetaAttribute,
      ApiKey,
    ]),
  ],
  controllers: [NearScraperController],
  providers: [
    NearScraperService,
    IpfsHelperService,
    MissingCollectionService,
    ContractConnectionService,
    DbHelperService,
  ],
  exports: [MissingCollectionService],
})
export class ScrapersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiProtectMiddleware).forRoutes({ path: "near-scraper/status", method: RequestMethod.GET });
  }
}
