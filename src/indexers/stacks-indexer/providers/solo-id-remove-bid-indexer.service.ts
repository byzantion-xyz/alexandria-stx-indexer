import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { BidState } from 'src/database/universal/entities/BidState';
import { Collection } from 'src/database/universal/entities/Collection';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType, CollectionBidStatus } from 'src/indexers/common/helpers/indexer-enums';
import { CreateCollectionBidStateArgs, TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateAcceptCollectionBidActionTO, CreateActionTO, CreateCancelBidActionTO, CreateCancelCollectionBidActionTO, CreateCollectionBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class SoloIdRemoveBidIndexerService implements IndexerService {
  private readonly logger = new Logger(SoloIdRemoveBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    @InjectRepository(BidState)
    private bidStateRepository: Repository<BidState>,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const events = this.stacksTxHelper.extractSmartContractLogEvents(tx.events);
    const event = events.find(e => e && e.data?.data && e.data.order);

    if (event) {
      const nonce = this.txBidHelper.build_nonce(sc.contract_key, event.data.order);
      const bidState = await this.txBidHelper.findBidStateByNonce(nonce);

      if (bidState && bidState.status === CollectionBidStatus.active) {
        await this.txBidHelper.cancelCollectionBid(bidState, tx);

        const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
          ActionName.unlist_bid, tx, bidState.collection, sc
        );
        const actionParams: CreateCancelBidActionTO = {
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

  async createAction(params: CreateActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);

      this.logger.log(`New action ${params.action}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }

}
