import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NearScraperController } from './near-scraper/near-scraper.controller';
import { NearScraperService } from './near-scraper/near-scraper.service';
import { IpfsHelperService } from './providers/ipfs-helper.service';
import { MissingSmartContractService } from './near-scraper/providers/missing-smart-contract.service';

@Module({
  imports: [
    PrismaModule
  ],
  controllers: [NearScraperController],
  providers: [
    NearScraperService,
    IpfsHelperService,
    MissingSmartContractService
  ],
  exports: [
    MissingSmartContractService
  ]
})
export class ScrapersModule {}
