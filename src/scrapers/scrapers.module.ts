import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { NearScraperController } from "./near-scraper/near-scraper.controller";
import { NearScraperService } from "./near-scraper/near-scraper.service";
import { IpfsHelperService } from "./providers/ipfs-helper.service";
import { MissingCollectionService } from "./near-scraper/providers/missing-collection.service";
import { ContractConnectionService } from "./near-scraper/providers/contract-connection-service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SmartContract } from "src/entities/SmartContract";
import { DbHelperService } from "./common/db-helper/db-helper.service";
import { Collection } from "src/entities/Collection";
import { CollectionScrape } from "src/entities/CollectionScrape";
import { CollectionCreator } from "src/entities/CollectionCreator";
import { NftMeta } from "src/entities/NftMeta";
import { NftMetaAttribute } from "src/entities/NftMetaAttribute";
import { CollectionAttribute } from "src/entities/CollectionAttribute";

@Module({
  imports: [
    PrismaModule,
    TypeOrmModule.forFeature([
      SmartContract,
      Collection,
      CollectionAttribute,
      CollectionScrape,
      CollectionCreator,
      NftMeta,
      NftMetaAttribute,
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
export class ScrapersModule {}
