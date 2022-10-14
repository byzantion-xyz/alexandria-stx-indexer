import { Injectable, Logger } from '@nestjs/common';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType } from 'src/indexers/common/helpers/indexer-enums';
import { CreateBidCommonArgs, CreateBidStateArgs, TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';

@Injectable()
export class BidIndexerService implements IndexerService {
  private readonly logger = new Logger(BidIndexerService.name);
  marketScs: SmartContract[];

  constructor (
    private txActionService: TxActionService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService
  ) {}
  
  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, 'contract_key');
    const token_id = this.txHelper.extractArgumentData(tx.args, scf, 'token_id'); 
    const price = this.txHelper.extractArgumentData(tx.args, scf, 'price');
    const buyer = tx.signer;

    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const bidCommonArgs: CreateBidCommonArgs = this.txBidHelper.setCommonBidArgs(
      tx, sc, nftMeta.collection, BidType.solo, price
    );
    const bidParams: CreateBidStateArgs = { ... bidCommonArgs, bid_buyer: buyer };

    const bidState = await this.txBidHelper.findActiveSoloBid(nftMeta, buyer);
    if (this.txBidHelper.isNewBid(tx, bidState)) {
      await this.txBidHelper.createOrReplaceBid(bidParams, bidState, nftMeta.id);
    } else {
      this.logger.debug(`Too Late`);
    }

    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.bid, tx, nftMeta, sc);
    const bidActionParams: CreateBidActionTO = {
      ...actionCommonArgs,
      bid_price: price,
      buyer: buyer
    };
    await this.createAction(bidActionParams);

    txResult.processed = true;

    return txResult;
  }
  
  async createAction(params: CreateBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
