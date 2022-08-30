import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
import { ListBotService } from "src/discord-bot/providers/list-bot.service";
import { MissingCollectionService } from "src/scrapers/near-scraper/providers/missing-collection.service";
import { CreateListActionTO } from "../../common/interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../../common/interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "../../common/helpers/indexer-enums";
import { NftState } from "src/database/universal/entities/NftState";
import { NearTxHelperService } from "src/indexers/near-indexer/providers/near-tx-helper.service";

@Injectable()
export class ListIndexerService implements IndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
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
    let msc: SmartContract;

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const price = this.txHelper.findAndExtractArgumentData(tx.args, scf, ["price", "token_price"]);
    let contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");

    // Check if has custodial smart contract
    if (sc.type.includes(SmartContractType.non_fungible_tokens)) {
      const account_sc = await this.smartContractRepository.findOneBy({ contract_key });
      if (account_sc && account_sc.type.includes(SmartContractType.marketplace)) {
        msc = account_sc;
      } else {
        msc = sc.custodial_smart_contract ? sc.custodial_smart_contract : account_sc;
      }

      if (!msc) {
        this.logger.log(`Marketplace smart_contract: ${contract_key} not found`);
        txResult.missing = true;
        return txResult;
      }
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, msc);
      const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, msc.id);
      const listActionParams: CreateListActionTO = {
        ...actionCommonArgs,
        list_price: price,
        seller: tx.signer
      };

      if (this.nearTxHelper.isNewerEvent(tx, nft_state_list)) {
        await this.txHelper.listMeta(nftMeta, tx, msc, price);

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
