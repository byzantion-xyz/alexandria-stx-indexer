import { Injectable, Logger } from '@nestjs/common';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType } from 'src/indexers/common/helpers/indexer-enums';
import { CreateBidCommonArgs, CreateBidStateArgs, TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class BidIndexerService implements IndexerService {
  private readonly logger = new Logger(BidIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txBidHelper: TxBidHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    if (!this.stacksTxHelper.isByzOldMarketplace(sc)) {
      txResult.missing = true;
      return txResult;
    }

    const contract_key = this.stacksTxHelper.extractAndParseContractKey(tx.args, scf);
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id'); 
    const price = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'bid_price');

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const bidCommonArgs: CreateBidCommonArgs = this.txBidHelper.setCommonV6BidArgs(
        tx, sc, nftMeta.collection, BidType.solo, price
      );
      const bidParams: CreateBidStateArgs = {
        ... bidCommonArgs,
        bid_buyer: tx.signer
      };
      let bidState = await this.txBidHelper.findActiveBid(nftMeta.collection.id, BidType.solo, nftMeta.id);

      if (this.txBidHelper.isNewBid(tx, bidState)) {
        await this.txBidHelper.createOrReplaceBid(bidParams, bidState, nftMeta.id);
      } else {
        this.logger.log(`Too Late`);        
      }

      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.bid, tx, nftMeta, sc);
      const bidActionParams: CreateBidActionTO = {
        ...actionCommonArgs,
        bid_price: price,
        buyer: tx.signer
      };
      await this.createAction(bidActionParams);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
