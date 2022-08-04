import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { Collection } from 'src/database/universal/entities/Collection';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType, CollectionBidStatus } from 'src/indexers/common/helpers/indexer-enums';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateCollectionBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { createBrotliDecompress } from 'zlib';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class CollectionOrderBookBidIndexerService implements IndexerService {
  private readonly logger = new Logger(CollectionOrderBookBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const events = this.stacksTxHelper.extractSmartContractLogEvents(tx.events);
    const event = events.find(e => e && e.data && e.data['collection-id']);
  
    if (event) {
      const contract_key = event?.data['collection-id'];
      const collection = await this.collectionRepository.findOne({ 
        where: { smart_contract: { contract_key }}
      });

      if (collection) {
        const bidCommonArgs = this.txBidHelper.setCommonBidArgs(
          tx, 
          sc, 
          event, 
          CollectionBidStatus.active,
          BidType.collection
        );
        const collectionBidArgs = {
          ... bidCommonArgs,
          bid_buyer: event.data.data.buyer,
          collection_id: collection.id
        };

        await this.txBidHelper.createBid(collectionBidArgs);

        const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
          ActionName.collection_bid, tx, sc, collection, sc
        );
        const acceptBidActionParams: CreateCollectionBidActionTO = {
          ...actionCommonArgs,
          bid_price: event.data.data.offer,
          buyer: event.data.data.buyer
        };
  
        await this.createAction(acceptBidActionParams);
        txResult.processed = true;
      } else {
        this.logger.log('Collection not found for: ${contract_key}');
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
