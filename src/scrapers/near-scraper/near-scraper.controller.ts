import { Body, Controller, Logger, Post } from '@nestjs/common';
import { NearScraperService } from './near-scraper.service';

@Controller('near-scraper')
export class NearScraperController {
  private readonly logger = new Logger(NearScraperController.name);

  constructor(
    private nearScraper: NearScraperService
  ) { }

  @Post('collection')
  async loadCollectionFromChain(
    @Body() data: { contract_key, token_id }
  ) {
    const result = this.nearScraper.scrape(data);
    return result;
  }
}
