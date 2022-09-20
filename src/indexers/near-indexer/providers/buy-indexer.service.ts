import { Logger, Injectable } from "@nestjs/common";

import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";

import { CreateBuyActionTO } from "../../common/interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../../common/interfaces/indexer-service.interface";

import { Action as ActionEntity } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { ActionName, SmartContractType } from "../../common/helpers/indexer-enums";
import { NearTxHelperService } from "src/indexers/near-indexer/providers/near-tx-helper.service";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";

const NFT_BUY_EVENT = 'nft_transfer_payout';
const RESOLVE_PURCHASE_EVENT = 'resolve_purchase';

@Injectable()
export class BuyIndexerService implements IndexerService {
  private readonly logger = new Logger(BuyIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txActionService: TxActionService,
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let msc = Object.assign({}, sc);

    const payout = this.nearTxHelper.findEventData(tx.receipts, NFT_BUY_EVENT);
    const purchase = this.nearTxHelper.findEventData(tx.receipts, RESOLVE_PURCHASE_EVENT);
    if (!payout || !purchase) {
      this.logger.debug(`No ${NFT_BUY_EVENT} found for tx hash: ${tx.hash}`);
      return txResult;
    }

    const token_id = this.txHelper.extractArgumentData(purchase.args, scf, "token_id");
    const contract_key = this.txHelper.extractArgumentData(purchase.args, scf, "contract_key");
    const price = this.txHelper.extractArgumentData(purchase.args, scf, "price");
    const seller = this.txHelper.extractArgumentData(purchase.args, scf, 'seller');

    // Check if has custodial smart contract
    if (sc.type.includes(SmartContractType.non_fungible_tokens) && sc.custodial_smart_contract) {
      msc = sc.custodial_smart_contract;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, msc);
      const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, msc.id);

      const buyActionParams: CreateBuyActionTO = { 
        ...actionCommonArgs,
        list_price: price,
        seller: seller,
        buyer: tx.signer
      };

      if (this.nearTxHelper.isNewerEvent(tx, nft_state_list)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, msc);
      } else {
        this.logger.log(`Too Late`);
      }
      await this.createAction(buyActionParams);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateBuyActionTO): Promise<ActionEntity> {
    return await this.txActionService.saveAction(params);
  }
}
