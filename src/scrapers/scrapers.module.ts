import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { NearScraperController } from './near-scraper/near-scraper.controller';
import { NearScraperService } from './near-scraper/near-scraper.service';

@Module({
  controllers: [NearScraperController],
  providers: [
    NearScraperService,
    PrismaService
  ]
})
export class ScrapersModule {}
