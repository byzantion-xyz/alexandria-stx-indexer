import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { SmartContractService } from 'src/indexers/common/helpers/smart-contract.service';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateAcceptBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { Repository } from 'typeorm';
import { NearTxHelperService } from './near-tx-helper.service';

const NFT_BUY_EVENT = 'nft_transfer_payout';
const RESOLVE_OFFER = 'resolve_offer';

@Injectable()
export class AcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(AcceptBidIndexerService.name);
  readonly marketScs?: SmartContract[];

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txBidHelper: TxBidHelperService,
    private txActionService: TxActionService,
    private scService: SmartContractService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const payout = this.nearTxHelper.findEventData(tx.receipts, NFT_BUY_EVENT);
    const receipt = this.nearTxHelper.findReceiptWithFunctionCall(tx.receipts, RESOLVE_OFFER);
    const offer = this.nearTxHelper.findEventData(tx.receipts, RESOLVE_OFFER);
    if (!payout || !receipt) {
      this.logger.log(`No ${NFT_BUY_EVENT} found for tx hash: ${tx.hash}`);
      return txResult;
    }

    const token_id = this.nearTxHelper.extractArgumentData(payout.args, scf, 'token_id'); 
    let price = this.nearTxHelper.extractArgumentData(tx.args, scf, "price");
    if (!price ) {
      price = this.nearTxHelper.extractArgumentData(offer.args, scf, "price");
    }
    const buyer = this.nearTxHelper.extractArgumentData(tx.args, scf, 'buyer');
    const contract_key = sc.contract_key;

    if (isNaN(price)) {
      this.logger.warn(`Unable to find sale price for tx hash ${tx.hash}`);
      return txResult;
    }

    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const msc = await this.scService.readOrFetchByKey(receipt.receiver_id, sc.chain_id, this.marketScs); 

    if (!msc) {
      this.logger.log(`Marketplace smart_contract: ${receipt.receiver_id} not found`);
      txResult.missing = true;
      return txResult;
    }

    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.accept_bid, tx, nftMeta, msc);
    const acceptBidActionParams: CreateAcceptBidActionTO = {
      ...actionCommonArgs,
      bid_price: price,
      buyer: buyer,
      seller: tx.signer
    };
    const bidState = await this.txBidHelper.findActiveSoloBid(nftMeta, msc, buyer);

    if (bidState && this.txBidHelper.isNewBid(tx, bidState)) {
      await this.txBidHelper.acceptSoloBid(bidState, tx);
      if (this.txHelper.isListedPreviously(nftMeta.nft_state, tx)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, msc);
      }
    }

    await this.createAction(acceptBidActionParams);
    
    txResult.processed = true;

    return txResult;
  }

  async createAction(params: CreateAcceptBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
