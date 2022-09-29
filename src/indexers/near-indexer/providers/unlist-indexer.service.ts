import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";
import {
  CreateUnlistActionTO,
} from "../../common/interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../../common/interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "../../common/helpers/indexer-enums";
import { Action } from "src/database/universal/entities/Action";
import { NearTxHelperService } from "src/indexers/near-indexer/providers/near-tx-helper.service";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";

@Injectable()
export class UnlistIndexerService implements IndexerService {
  private readonly logger = new Logger(UnlistIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txActionService: TxActionService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };
    let msc = Object.assign({}, sc);

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
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
      const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, msc.id);
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, msc);

      const unlistActionParams: CreateUnlistActionTO = {
        ...actionCommonArgs,
        list_price: nft_state_list?.list_price,
        seller: nft_state_list?.list_seller || tx.signer
      };

      if (this.nearTxHelper.isNewerEvent(tx, nft_state_list)) {
        await this.txHelper.unlistMeta(nftMeta, tx, msc);
      } else {
        this.logger.debug(`Too Late`);
      }

      await this.createAction(unlistActionParams);

      txResult.processed = true;
    } else {
      this.logger.debug(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateUnlistActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
