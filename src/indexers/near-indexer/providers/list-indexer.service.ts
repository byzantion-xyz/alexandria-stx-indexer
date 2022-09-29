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
import { TxActionService } from "src/indexers/common/providers/tx-action.service";

const NFT_LIST_EVENT = 'nft_on_approve';

@Injectable()
export class ListIndexerService implements IndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txActionService: TxActionService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };
    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");

    const receipt = this.nearTxHelper.findReceiptWithFunctionCall(tx.receipts, NFT_LIST_EVENT, { token_id });
    if (!receipt) {
      this.logger.warn(`No ${NFT_LIST_EVENT} found for tx hash: ${tx.hash}`);
      return txResult;
    }

    const approve = this.nearTxHelper.findEventData(tx.receipts, NFT_LIST_EVENT);
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
      } else {
        this.logger.debug(`Too Late`);
      }
      await this.createAction(listActionParams);

      txResult.processed = true;
    } else {
      this.logger.debug(`NftMeta not found ${sc.contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateListActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
