import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
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

const NFT_LIST_EVENT = 'nft_on_approve';

@Injectable()
export class ListIndexerService implements IndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private missingCollectionService: MissingCollectionService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const receipt = this.nearTxHelper.findReceiptWithEvent(tx.receipts, NFT_LIST_EVENT);
    if (!receipt) {
      this.logger.warn(`No ${NFT_LIST_EVENT} found for tx hash: ${tx.hash}`);
      txResult.processed = true;
      return txResult;
    }
    const approve = this.nearTxHelper.findEventData([receipt], NFT_LIST_EVENT);

    const token_id = this.txHelper.extractArgumentData(approve.args, scf, "token_id");
    const price = this.txHelper.findAndExtractArgumentData(approve.args, scf, ["price", "token_price"]);
    if (isNaN(price)) {
      this.logger.warn(`Unable to find list price for tx hash ${tx.hash}`);
      return txResult;
    }

    const msc = await this.smartContractRepository.findOneBy({ contract_key: receipt.receiver_id });
    if (!msc) {
      this.logger.warn(`Marketplace smart_contract: ${receipt.receiver_id} not found`);
      txResult.missing = true;
      return txResult;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(sc.contract_key, token_id);

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
        await this.createAction(listActionParams);
      } else {
        this.logger.log(`Too Late`);
        await this.createAction(listActionParams);
      }
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${sc.contract_key} ${token_id}`);

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
