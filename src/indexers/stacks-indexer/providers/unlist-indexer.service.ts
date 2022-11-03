import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { CreateUnlistActionTO } from "src/indexers/common/interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";

import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { ActionName } from "src/indexers/common/helpers/indexer-enums";
import { Action } from "src/database/universal/entities/Action";
import { StacksTxHelperService } from "./stacks-tx-helper.service";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";

@Injectable()
export class UnlistIndexerService implements IndexerService {
  private readonly logger = new Logger(UnlistIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txActionService: TxActionService
  ) { }

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");
    const seller = this.stacksTxHelper.findAndExtractNftRecipient(tx.events);
    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, sc);
    const nft_list_state = this.txHelper.findStateList(nftMeta.nft_state, sc.id);

    const unlistActionParams: CreateUnlistActionTO = {
      ...actionCommonArgs,
      list_price: nft_list_state?.list_price,
      seller: seller || tx.signer,
      market_name: nft_list_state?.commission?.market_name || null,
      commission_id: nft_list_state?.commission?.id
    };

    if (this.stacksTxHelper.isNewerEvent(tx, nft_list_state)) {
      await this.txHelper.unlistMeta(nftMeta, tx, sc);
    } else {
      this.logger.debug(`Too Late`);
    }
    await this.createAction(unlistActionParams);

    txResult.processed = true;

    return txResult;
  }

  async createAction(params: CreateUnlistActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
