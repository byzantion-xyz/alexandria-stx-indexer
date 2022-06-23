import { Injectable, Logger } from '@nestjs/common';
import { SmartContract } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { runScraperData } from '../dto/run-scraper-data.dto';
import { NearScraperService } from '../near-scraper.service';
import { requestMissingSmartContract } from './dto/request-missing-smart-contract.dto';

@Injectable()
export class MissingSmartContractService {
  private readonly logger = new Logger(MissingSmartContractService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private nearScraperService: NearScraperService
  ) { }

  async scrapeMissing(data: requestMissingSmartContract) {
    const sc: SmartContract = await this.prismaService.smartContract
      .findUnique({ where: { contract_key: data.contract_key } });

    if (sc) {
      // TODO: Load missing NftMeta
    } else {
      this.logger.log(`Call scraper for missing smartContract.contract_key= ${data.contract_key}`);
      // Scrape the missing smart contract and NftMetas
      let scrapeParams: runScraperData = {
        contract_key: data.contract_key 
      };
      await this.nearScraperService.scrape(scrapeParams);
    }
  }
}