import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { NftStateArguments, TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { CreateListActionTO } from "src/indexers/common/interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";

import { Action, ActionName } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { StacksTxHelperService } from "./stacks-tx-helper.service";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";

@Injectable()
export class ListIndexerService implements IndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const price = this.stacksTxHelper.extractArgumentData(tx.args, scf, "list_price");
    if (isNaN(price)) {
      this.logger.warn(`Unable to find list price for tx hash ${tx.hash}`);
      return txResult;
    }
    const collection_map_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "collection_map_id");
    const commission_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "commission_trait");
    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");

    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const commission = await this.txHelper.findCommissionByKey(sc, contract_key, commission_key);
    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, sc);
    const listActionParams: CreateListActionTO = {
      ...actionCommonArgs,
      list_price: price,
      seller: tx.signer,
      ...(commission && { commission_id: commission.id }),
      market_name: commission?.market_name || null,
    };

    const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, sc.id);

    if (this.stacksTxHelper.isNewerEvent(tx, nft_state_list)) {
      const args: NftStateArguments = {
        ...(collection_map_id && { collection_map_id }),
      };
      await this.txHelper.listMeta(nftMeta, tx, sc, price, commission?.id, args);
    }

    await this.createAction(listActionParams);

    txResult.processed = true;

    return txResult;
  }

  async createAction(params: CreateListActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
