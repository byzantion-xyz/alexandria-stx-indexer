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
    @Body() data: { contract_key, token_series_id, token_id, starting_token_id, ending_token_id, scrape_non_custodial_from_paras, force_scrape}
  ) {
    const result = await this.nearScraper.scrape(data);
    return result;
  }

  @Post('update-rarities')
  async updateRarities(
    @Body() data: { slug }
  ) {
    const result = await this.nearScraper.updateRarities(data.slug);
    return result;
  }

  @Post('create-collection-attributes')
  async createCollectionAttributes(
    @Body() data: { slug }
  ) {
    const result = await this.nearScraper.createCollectionAttributes(data.slug);
    return result;
  }
}
