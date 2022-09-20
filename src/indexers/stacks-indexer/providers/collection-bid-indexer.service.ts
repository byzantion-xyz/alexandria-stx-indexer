import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { Collection } from 'src/database/universal/entities/Collection';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType } from 'src/indexers/common/helpers/indexer-enums';
import { CreateBidCommonArgs, CreateCollectionBidStateArgs, TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateCollectionBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class CollectionBidIndexerService implements IndexerService {
  private readonly logger = new Logger(CollectionBidIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txActionService: TxActionService,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    if (!this.stacksTxHelper.isByzOldMarketplace(sc)) {
      txResult.missing = true;
      return txResult;
    }

    const contract_key = this.stacksTxHelper.extractAndParseContractKey(tx.args, scf);
    const price = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'bid_price');

    const collection = await this.collectionRepository.findOne({ where: { 
      smart_contract: { contract_key }
    }});

    if (collection) {
      const bidCommonArgs: CreateBidCommonArgs = this.txBidHelper.setCommonV6BidArgs(
        tx, sc, collection, BidType.collection, price
      );
      const collectionBidArgs: CreateCollectionBidStateArgs = {
        ... bidCommonArgs,
        bid_buyer: tx.signer
      };

      const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
        ActionName.collection_bid, tx, collection, sc
      );
      const actionParams: CreateCollectionBidActionTO = {
        ...actionCommonArgs,
        buyer: tx.signer,
        bid_price: price
      };
      
      let bidState = await this.txBidHelper.findActiveBid(collection.id, BidType.collection);

      if (this.txBidHelper.isNewBid(tx, bidState)) {
        await this.txBidHelper.createOrReplaceBid(collectionBidArgs, bidState);
      } else {
        this.logger.log('Too late bid');
      }

      await this.createAction(actionParams);
      
      txResult.processed = true;
    } else {
      this.logger.log(`Missing Collection ${contract_key} ${tx.hash}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateCollectionBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
