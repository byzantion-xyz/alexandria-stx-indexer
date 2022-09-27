import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
import { CreateRelistActionTO } from "../../common/interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../../common/interfaces/indexer-service.interface";

import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { ActionName } from "../../common/helpers/indexer-enums";
import { NearTxHelperService } from "src/indexers/near-indexer/providers/near-tx-helper.service";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";

@Injectable()
export class RelistIndexerService implements IndexerService {
  private readonly logger = new Logger(RelistIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };
    const msc = Object.assign({}, sc);

    if (this.nearTxHelper.isAnyReceiptFailure(tx.receipts)) return txResult;

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const price = this.txHelper.extractArgumentData(tx.args, scf, "price");
    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, msc);
      const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, msc.id);
      const listActionParams: CreateRelistActionTO = {
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

  async createAction(params: CreateRelistActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
