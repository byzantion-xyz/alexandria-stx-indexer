import { Injectable, Logger } from '@nestjs/common';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, CollectionBidStatus } from 'src/indexers/common/helpers/indexer-enums';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateAcceptBidActionTO, CreateActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class SoloIdAcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(SoloIdAcceptBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const events = this.stacksTxHelper.extractSmartContractLogEvents(tx.events);
    const event = events.find(e => e && e.data?.data && e.data.order && e.data.data['item-id']);
    
    if (event) {
      const token_id: bigint = event.data.data['item-id'];
      const bid_contract_nonce = this.txBidHelper.build_nonce(sc.contract_key, event.data.order);
      const bidState = await this.txBidHelper.findSoloBidStateByNonce(bid_contract_nonce);

      if (bidState && bidState.status === CollectionBidStatus.active) {
        const { contract_key } = bidState.nft_metas[0].meta.smart_contract;

        const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id.toString());

        if (nftMeta) {
          await this.txBidHelper.acceptSoloBid(bidState, tx);
          await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, sc, bidState.bid_seller);
  
          const actionCommonArgs = this.txHelper.setCommonActionParams(
            ActionName.accept_bid, tx, nftMeta, sc
          );
          const acceptBidActionParams: CreateAcceptBidActionTO = {
            ...actionCommonArgs,
            nonce: BigInt(bidState.nonce),
            bid_price: bidState.bid_price,
            buyer: bidState.bid_buyer,
            seller: bidState.bid_seller
          };

          await this.createAction(acceptBidActionParams);
          txResult.processed = true;
        } else {
          this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
          txResult.missing = true;
        }
      } else if (bidState) {
        this.logger.log(`Solo id bid already "${bidState.status}" with nonce: ${bidState.nonce}`);
        txResult.processed = true;
      } else {
        this.logger.log(`bid_state not found bid_contract_nonce: ${bid_contract_nonce}`);
        txResult.missing = true;       
      }

    } else {
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateAcceptBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
