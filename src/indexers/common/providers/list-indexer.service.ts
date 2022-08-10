import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../helpers/tx-helper.service";
import { ListBotService } from "src/discord-bot/providers/list-bot.service";
import { MissingCollectionService } from "src/scrapers/near-scraper/providers/missing-collection.service";
import { CreateListActionTO } from "../interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "../helpers/indexer-enums";
import { NftState } from "src/database/universal/entities/NftState";

@Injectable()
export class ListIndexerService implements IndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private listBotService: ListBotService,
    private missingCollectionService: MissingCollectionService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let market_sc: SmartContract;

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const price = this.txHelper.extractArgumentData(tx.args, scf, "price");
    
    let contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");

    // Check if custodial
    if (sc.type.includes(SmartContractType.non_fungible_tokens)) {
      if (contract_key) {
        market_sc = await this.smartContractRepository.findOneBy({ contract_key });
      }
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);
   
    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, market_sc);
      const listActionParams: CreateListActionTO = {
        ...actionCommonArgs,
        list_price: price,
        seller: tx.signer
      };
    
      if (this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
        await this.txHelper.listMeta(nftMeta.id, tx, sc, price);

        const newAction = await this.createAction(listActionParams);
        if (newAction && tx.notify) {
          this.listBotService.createAndSend(newAction.id);
        }
      } else {
        this.logger.log(`Too Late`);
        await this.createAction(listActionParams);
      }
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);

      //this.missingCollectionService.scrapeMissing({ contract_key, token_id });
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateListActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);
      this.logger.log(`New action ${params.action}: ${saved.id} `);
      return saved;
    } catch (err) {}
  }
}
