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
import { CreateAcceptBidActionTO, CreateAcceptCollectionBidActionTO, CreateActionTO, CreateCollectionBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class IdAcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(IdAcceptBidIndexerService.name);

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
    const event = events.find(e => e && e.data?.data && e.data.order && e.data.data['item-id']);
    
    if (event) {
      const token_id = event.data.data['item-id'];
      const bidState = await this.bidStateRepository.findOne({ where: {
        bid_contract_nonce: this.txBidHelper.build_nonce(sc.contract_key, event.data.order),
      }, relations: { collection: { smart_contract: true } }});

      const { contract_key } = bidState.collection.smart_contract;

      const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

      if (bidState && bidState.status !== CollectionBidStatus.matched && nftMeta) {
        await this.txBidHelper.acceptBid(bidState, tx, nftMeta);

        const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
          ActionName.accept_bid, tx, bidState.collection, sc
        );
        const acceptBidActionParams: CreateAcceptBidActionTO = {
          ...actionCommonArgs,
          nonce: BigInt(bidState.nonce),
          bid_price: bidState.bid_price,
          buyer: bidState.bid_buyer,
          seller: bidState.bid_seller
        };
  
        await this.createAction(acceptBidActionParams);
      } else {
        this.logger.log('Collection bid already "matched"', bidState.nonce);
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
