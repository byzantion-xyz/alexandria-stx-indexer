import { Body, Controller, Logger, Post } from '@nestjs/common';
import { NearScraperService } from './near-scraper.service';

@Controller('near-scraper')
export class NearScraperController {
  private readonly logger = new Logger(NearScraperController.name);

  constructor(
    private nearScraper: NearScraperService
  ) { }

  @Post('scrape')
  async scrape(
    @Body() data: { contract_key, token_id, starting_token_id, ending_token_id, scrape_from_paras, override_frozen, force_scrape}
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
    const result = await this.nearScraper.createCollectionAttributes(data.contract_key);
    return result;
  }
}
