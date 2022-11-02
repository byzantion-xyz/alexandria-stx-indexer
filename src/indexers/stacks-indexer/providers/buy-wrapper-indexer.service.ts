import { Logger, Injectable } from "@nestjs/common";

import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";

import { CreateBuyActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { Action as ActionEntity } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName } from "src/indexers/common/helpers/indexer-enums";
import { StacksTxHelperService } from "./stacks-tx-helper.service";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";
import { SmartContractService } from "src/indexers/common/helpers/smart-contract.service";

@Injectable()
export class BuyWrapperIndexerService implements IndexerService {
  private readonly logger = new Logger(BuyWrapperIndexerService.name);
  readonly marketScs?: SmartContract[];

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private scService: SmartContractService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");
    const market_contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'market');
    const seller = this.stacksTxHelper.findAndExtractSellerFromEvents(tx.events);
    const price = this.stacksTxHelper.findAndExtractSalePriceFromEvents(tx.events); 

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta.smart_contract.contract_key_wrapper || market_contract_key) {
      let msc = nftMeta.smart_contract.contract_key_wrapper ? nftMeta.smart_contract 
        : await this.scService.readOrFetchByKey(market_contract_key, sc.chain_id, this.marketScs); 

      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.buy, tx, nftMeta, sc);
      const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, msc.id);

      const buyActionParams: CreateBuyActionTO = { 
        ...actionCommonArgs,
        list_price: price,
        seller: seller,
        buyer: tx.signer,
        market_name: nft_state_list?.commission?.market_name || null,
        commission_id: nft_state_list?.commission?.id || null
      };

      if (this.stacksTxHelper.isNewerEvent(tx, nft_state_list)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, msc, buyActionParams.seller);
        await this.createAction(buyActionParams);
      } else  {
        this.logger.debug(`Too Late`);
        // Create missing action
        await this.createAction(buyActionParams);
      }
      txResult.processed = true;
    } else {
      this.logger.warn(`contract_key_wrapper not found for ${sc.contract_key}`);  
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateBuyActionTO): Promise<ActionEntity> {
    return await this.txActionService.saveAction(params);
  }
}
