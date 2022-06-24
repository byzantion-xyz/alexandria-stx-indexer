import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { runScraperData } from '../dto/run-scraper-data.dto';
import { NearScraperService } from '../near-scraper.service';
import { requestMissingCollection } from './dto/request-missing-collection.dto';

@Injectable()
export class MissingCollectionService {
  private readonly logger = new Logger(MissingCollectionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private nearScraperService: NearScraperService
  ) { }

  async scrapeMissing(data: requestMissingCollection) {

    let scrapeParams: runScraperData = {
      contract_key: data.contract_key
    };

    if (data.contract_key == "x.paras.near") {
      scrapeParams.token_series_id = data.token_id;
    } 
    // Get rid of else once we want to enable scraping for x.paras.near custodial collections
    else {
      await this.nearScraperService.scrape(scrapeParams);
    }

  }
}