import { Injectable, Logger } from "@nestjs/common";
import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { ActionName, SmartContractType } from "src/indexers/common/helpers/indexer-enums";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { CreateBurnActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";
import { NearTxHelperService } from "./near-tx-helper.service";

@Injectable()
export class NftBurnEventIndexerService implements IndexerService {
  private readonly logger = new Logger(NftBurnEventIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };
    let msc: SmartContract;

    const token_ids = this.nearTxHelper.extractArgumentData(tx.args, scf, 'token_ids');
    const seller = this.nearTxHelper.extractArgumentData(tx.args, scf, 'owner');
    if (!token_ids || !token_ids.length) {
      this.logger.warn(`Unable to find token_ids tx hash: ${tx.hash}`);
      return txResult;
    }
    const token_id = token_ids[0];
    const contract_key = sc.contract_key;

    if (sc.type.includes(SmartContractType.non_fungible_tokens) && sc.custodial_smart_contract) {
      msc = sc.custodial_smart_contract ;
    }

    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.burn, tx, nftMeta, msc);
    const burnActionParams: CreateBurnActionTO = { ...actionCommonArgs, seller };

    if (!nftMeta.nft_state || !nftMeta.nft_state.burned) {
      // Unlist listed meta in all marketplaces
      if (this.txHelper.isListedInAnyMarketplace(nftMeta.nft_state)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx);
      }
      if (nftMeta.nft_state && nftMeta.nft_state.staked) {
        await this.txHelper.unstakeMeta(nftMeta.id, tx);
      }
      
      await this.txHelper.burnMeta(nftMeta.id);
      // TODO: Cancel any active bids when bids are implemented in NEAR
    } else {
      this.logger.debug(`Too Late`);
    }
    await this.createAction(burnActionParams);

    txResult.processed = true;

    return txResult;
  }

  async createAction(params: CreateBurnActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
