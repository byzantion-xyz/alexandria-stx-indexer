import { Injectable, Logger } from '@nestjs/common';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, CollectionBidStatus } from 'src/indexers/common/helpers/indexer-enums';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateCancelCollectionBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class CollectionRemoveOrderBookBidIndexerService implements IndexerService {
  private readonly logger = new Logger(CollectionRemoveOrderBookBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const events = this.stacksTxHelper.extractSmartContractLogEvents(tx.events);
    const event = events.find(e => e && e.data?.data && e.data.order);

    if (event) {
      const nonce = this.stacksTxHelper.build_nonce(sc.contract_key, event.data.order);
      const bidState = await this.stacksTxHelper.findBidStateByNonce(nonce);

      if (bidState && bidState.status === CollectionBidStatus.active) {
        await this.txBidHelper.cancelBid(bidState, tx);

        const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
          ActionName.cancel_collection_bid, tx, bidState.collection, sc
        );
        const actionParams: CreateCancelCollectionBidActionTO = {
          ...actionCommonArgs,
          nonce: BigInt(bidState.nonce),
          bid_price: bidState.bid_price,
          buyer: bidState.bid_buyer
        };
  
        await this.createAction(actionParams);
        txResult.processed = true;
      } else if (bidState) {
        this.logger.warn(`Unable to cancel collection bid nonce: ${bidState.nonce} status: ${bidState.status}`);
        txResult.processed = true;
      } else {
        txResult.missing = true;
      }
    } else {
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateCancelCollectionBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
