import { Logger, Injectable } from "@nestjs/common";

import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";

import { CreateBuyActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";

import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { ActionName } from "src/indexers/common/helpers/indexer-enums";
import { StacksTxHelperService } from "./stacks-tx-helper.service";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";

@Injectable()
export class BuyIndexerService implements IndexerService {
  private readonly logger = new Logger(BuyIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txActionService: TxActionService
  ) { }

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");
    const seller = this.stacksTxHelper.findAndExtractSellerFromEvents(tx.events);
    const price = this.stacksTxHelper.findAndExtractSalePriceFromEvents(tx.events); 

    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.buy, tx, nftMeta, sc);
    const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, sc.id);

      const buyActionParams: CreateBuyActionTO = { 
        ...actionCommonArgs,
        list_price: price,
        seller: seller,
        buyer: tx.signer,
        market_name: nft_state_list?.commission?.market_name || null,
        commission_id: nft_state_list?.commission?.id || null
      };

    if (this.stacksTxHelper.isNewerEvent(tx, nft_state_list)) {
      await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, sc, buyActionParams.seller);
      await this.createAction(buyActionParams);
    } else {
      this.logger.debug(`Too Late`);
      // Create missing action
      await this.createAction(buyActionParams);
    }
    txResult.processed = true;


    return txResult;
  }

  async createAction(params: CreateBuyActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
