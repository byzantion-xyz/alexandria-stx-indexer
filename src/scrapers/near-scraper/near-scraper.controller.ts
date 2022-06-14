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
    @Body() data: { contract_key, token_id, override_frozen }
  ) {
    const result = await this.nearScraper.scrape(data);
    return result;
  }

  @Post('update-rarities')
  async updateRarities(
    @Body() data: { contract_key, override_frozen }
  ) {
    const result = await this.nearScraper.updateRarities(data.contract_key, data.override_frozen);
    return result;
  }

  @Post('create-collection-attributes')
  async createCollectionAttributes(
    @Body() data: { contract_key }
  ) {
    const result = await this.nearScraper.loadCollectionAttributes(data.contract_key);
    return result;
  }
}
