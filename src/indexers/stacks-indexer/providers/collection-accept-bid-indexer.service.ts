import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { BidState } from 'src/database/universal/entities/BidState';
import { Collection } from 'src/database/universal/entities/Collection';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType, CollectionBidStatus } from 'src/indexers/common/helpers/indexer-enums';
import { CreateBidCommonArgs, CreateCollectionBidStateArgs, TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateCancelBidActionTO, CreateCollectionBidActionTO, CreateUnlistCollectionBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class CollectionAcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(CollectionAcceptBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    @InjectRepository(BidState)
    private bidStateRepository: Repository<BidState>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, 'contract_key');
    const token_id = this.txHelper.extractArgumentData(tx.args, scf, 'token_id');

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      let bidState = await this.txBidHelper.findActiveBid(nftMeta.collection.id, BidType.collection);
      
      if (bidState && this.txBidHelper.isNewBid(tx, bidState)) {
        await this.txBidHelper.acceptBid(bidState, tx, nftMeta);

        await this.txHelper.unlistMeta(nftMeta.id, tx.index, tx.block_height);

        const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
          ActionName.accept_bid, tx, nftMeta.collection, sc
        );
        const actionParams: CreateCollectionBidActionTO = {
          ...actionCommonArgs,
          bid_price: bidState.bid_price,
          buyer: tx.signer
        };
        await this.createAction(actionParams);
      } else {
        this.logger.log('Too late');
      }
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id} `);
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
