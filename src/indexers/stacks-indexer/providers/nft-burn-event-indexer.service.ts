import { Injectable, Logger } from "@nestjs/common";
import { Action, ActionName } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { CreateBurnActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";
import { StacksTxHelperService } from "./stacks-tx-helper.service";

@Injectable()
export class NftBurnEventIndexerService implements IndexerService {
  private readonly logger = new Logger(NftBurnEventIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const event = this.stacksTxHelper.findNftEventByIndex(tx.events, tx.args.event_index);
    const token_id = this.stacksTxHelper.extractTokenIdFromNftEvent(event);
    if (isNaN(token_id)) {
      this.logger.warn("Unable to extract token_id from NFT event");
      return txResult;
    }
    const { contract_key } = this.stacksTxHelper.parseAssetIdFromNftEvent(event);
    const seller = event.asset.sender;

    const asset = await this.stacksTxHelper.parseAssetIdFromNftEvent(event);
    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id, asset.name);

    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.burn, tx, nftMeta, sc);
    const burnActionParams: CreateBurnActionTO = { ...actionCommonArgs, seller };

    if (!nftMeta.nft_state || !nftMeta.nft_state.burned) {
      if (this.txHelper.isListedInAnyMarketplace(nftMeta.nft_state)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx);
      }
      if (nftMeta.nft_state && nftMeta.nft_state.staked) {
        await this.txHelper.unstakeMeta(nftMeta.id, tx);
      }

      await this.txHelper.burnMeta(nftMeta.id);
    } else {
      this.logger.debug(`NftMeta ${contract_key} ${token_id} is already burned`);
    }

    await this.createAction(burnActionParams);

    txResult.processed = true;

    return txResult;
  }
  async createAction(params: CreateBurnActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
