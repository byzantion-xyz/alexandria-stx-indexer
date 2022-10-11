import { Injectable, Logger } from "@nestjs/common";
import { runScraperData } from "../dto/run-scraper-data.dto";
import { NearScraperService } from "../near-scraper.service";
import { ContractConnectionService } from "./contract-connection-service";
import { requestMissingCollection } from "./dto/request-missing-collection.dto";

@Injectable()
export class MissingCollectionService {
  private readonly logger = new Logger(MissingCollectionService.name);

  constructor(
    private nearScraperService: NearScraperService,
    private readonly contractConnectionService: ContractConnectionService
  ) {}

  async scrapeMissing(data: requestMissingCollection) {
    // check if the transaction reciever (contract_key) is a nft smart contract (as opposed to tx receivers being from other types of dApps)
    // return early if it is not
    const nearConnection = await this.contractConnectionService.connectNear();
    const contract = this.contractConnectionService.getContract(data.contract_key, nearConnection);
    let isNftSmartContract = true;
    try {
      await contract.nft_metadata();
    } catch (err) {
      isNftSmartContract = false;
    }
    if (!isNftSmartContract) return;

    let scrapeParams: runScraperData = {
      contract_key: data.contract_key,
    };

    if (data.contract_key == "x.paras.near") {
      scrapeParams.token_id = data.token_id;
    }

    await this.nearScraperService.scrape(scrapeParams);
  }
}
