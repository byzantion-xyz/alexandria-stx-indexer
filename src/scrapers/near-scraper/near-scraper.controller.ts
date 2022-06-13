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

  @Post('updateRarities')
  async updateRarities(
    @Body() data: { contract_key, override_frozen }
  ) {
    const result = this.nearScraper.updateRarities(data);
    return result;
  }

  @Post('createCollectionAttributes')
  async createCollectionAttributes(
    @Body() data: { contract_key, slug }
  ) {
    const result = this.nearScraper.loadCollectionAttributes(data);
    return result;
  }
}
