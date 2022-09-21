import { Injectable, Logger } from '@nestjs/common';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { TxStakingHelper } from 'src/indexers/common/helpers/tx-staking-helper';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateUnstakeActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { ActionName, SmartContractType } from 'src/indexers/common/helpers/indexer-enums';
import { NearTxHelperService } from './near-tx-helper.service';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';

const NFT_TRANSFER_EVENT = 'nft_transfer';
//const RESOLVE_WITHDRAW = ['withdraw_nft_callback', 'callback_post_withdraw_nft'];

@Injectable()
export class UnstakeIndexerService implements IndexerService {
  private readonly logger = new Logger(UnstakeIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txStakingHelper: TxStakingHelper,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    
    const transfer = this.nearTxHelper.findReceiptWithFunctionCall(tx.receipts, NFT_TRANSFER_EVENT);
    if (!transfer) {
      this.logger.debug(`No ${NFT_TRANSFER_EVENT} event found for tx hash ${tx.hash}`);
      return txResult;
    }

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");

    if (!sc.type.includes(SmartContractType.staking)) {
      this.logger.log(`Stake contract: ${sc.contract_key} does not have staking type`);
      txResult.missing = true;
      return txResult;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);   
    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, sc);
      const unstakeActionParams: CreateUnstakeActionTO = {
        ...actionCommonArgs,
        seller: tx.signer,
        market_name: null
      };

      if (this.txStakingHelper.isNewStakingBlock(tx, nftMeta.nft_state)) {
        await this.txHelper.unstakeMeta(nftMeta.id, tx);
      } else {
        this.logger.log(`Too Late`);
      }
      await this.createAction(unstakeActionParams);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateUnstakeActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);

  }
}