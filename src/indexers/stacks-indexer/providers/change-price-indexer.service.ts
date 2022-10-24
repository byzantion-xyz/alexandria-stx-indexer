import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { SmartContractService } from 'src/indexers/common/helpers/smart-contract.service';
import { NftStateArguments, TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateRelistActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class ChangePriceIndexerService implements IndexerService {
  private readonly logger = new Logger(ChangePriceIndexerService.name);
  readonly marketScs?: SmartContract[];

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txActionService: TxActionService,
    private scService: SmartContractService
  ) { }

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const first_market = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'first_market');
    const second_market = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'second_market');
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const price = this.stacksTxHelper.extractArgumentData(tx.args, scf, "price");
    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");
    const collection_map_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "collection_map_id");
    if (isNaN(price)) {
      this.logger.warn(`Unable to find list price for tx hash ${tx.hash}`);
      return txResult;
    }

    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const unlist_sc = await this.scService.readOrFetchByKey(first_market, sc.chain_id, this.marketScs);
    const list_sc = await this.scService.readOrFetchByKey(second_market, sc.chain_id, this.marketScs);

    const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, list_sc.id);
    const nft_state_unlist = this.txHelper.findStateList(nftMeta.nft_state, unlist_sc.id);

    const commission = await this.txHelper.findCommissionByKey(list_sc, contract_key);
    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.relist, tx, nftMeta, sc);
    const relistActionParams: CreateRelistActionTO = {
      ...actionCommonArgs,
      list_price: price,
      seller: tx.signer,
      ... (commission && { commission_id: commission.id })
    };

    // Unlist original market
    if (this.stacksTxHelper.isNewerEvent(tx, nft_state_unlist) && unlist_sc) {
      nftMeta.nft_state = await this.txHelper.unlistMeta(nftMeta, tx, unlist_sc);
    }

    // List in new market
    if (this.stacksTxHelper.isNewerEvent(tx, nft_state_list)) {
      const args: NftStateArguments = {
        collection_map_id: collection_map_id || contract_key || null
      };
      await this.txHelper.listMeta(nftMeta, tx, list_sc, price, commission?.id, args);
    } else {
      this.logger.debug(`Too Late`);
    }
    await this.createAction(relistActionParams);

    txResult.processed = true;

    return txResult;
  }

  async createAction(params: CreateRelistActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
