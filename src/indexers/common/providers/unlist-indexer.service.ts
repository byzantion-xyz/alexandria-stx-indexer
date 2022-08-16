import { Logger, Injectable, NotAcceptableException } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../helpers/tx-helper.service";
import {
  CreateActionCommonArgs,
  CreateUnlistActionTO,
} from "../interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "../helpers/indexer-enums";
import { Action } from "src/database/universal/entities/Action";
import { NearTxHelperService } from "src/indexers/near-indexer/providers/near-tx-helper.service";

@Injectable()
export class UnlistIndexerService implements IndexerService {
  private readonly logger = new Logger(UnlistIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
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
    let contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");

    // Check if has custodial smart contract
    if (sc.type.includes(SmartContractType.non_fungible_tokens)) {
      if (sc.custodial_smart_contract) {
        msc = sc.custodial_smart_contract;
      }
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) { 
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, msc);
      
      if (this.nearTxHelper.isNewerEvent(tx, nftMeta.nft_state, msc.id)) {
        const nft_list_state = nftMeta.nft_state?.nft_states_list?.find(s => s.nft_state_id === msc.id);
        const unlistActionParams: CreateUnlistActionTO = {
          ...actionCommonArgs,
          list_price: nft_list_state?.list_price,
          seller: nft_list_state?.list_seller,
          commission_id: nft_list_state?.commission_id
        };

        await this.txHelper.unlistMeta(nftMeta, tx, msc);
        await this.createAction(unlistActionParams);
      } else {
        this.logger.log(`Too Late`);
      }

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateUnlistActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);

      this.logger.log(`New action ${params.action}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }
}
