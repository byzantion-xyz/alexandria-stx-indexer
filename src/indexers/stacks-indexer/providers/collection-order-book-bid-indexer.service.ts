import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { Collection } from 'src/database/universal/entities/Collection';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType } from 'src/indexers/common/helpers/indexer-enums';
import { CreateCollectionBidStateArgs, TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateCollectionBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class CollectionOrderBookBidIndexerService implements IndexerService {
  private readonly logger = new Logger(CollectionOrderBookBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    private txActionService: TxActionService,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const events = this.stacksTxHelper.extractSmartContractLogEvents(tx.events);
    const event = events.find(e => e && e.data?.data && e.data.data['collection-id']);
  
    if (event) {
      const contract_key = this.stacksTxHelper.extractContractKeyFromEvent(event);
      const collection = await this.collectionRepository.findOne({ 
        where: { smart_contract: { contract_key }}
      });
      const bid_sc = await this.smartContractRepository.findOne({ where: { contract_key: event.contract_log.contract_id }});

      if (contract_key && collection && bid_sc) {
        const bidCommonArgs = this.stacksTxHelper.setCommonBidArgs(
          tx, bid_sc, event, collection, BidType.collection
        );
        const collectionBidArgs: CreateCollectionBidStateArgs = {
          ... bidCommonArgs,
          bid_buyer: event.data.data.buyer,
          collection_id: collection.id
        };

        await this.txBidHelper.createOrReplaceBid(collectionBidArgs);

        const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
          ActionName.collection_bid, tx, collection, sc
        );
        const acceptBidActionParams: CreateCollectionBidActionTO = {
          ...actionCommonArgs,
          bid_price: event.data.data.offer,
          buyer: event.data.data.buyer
        };
  
        await this.createAction(acceptBidActionParams);
        txResult.processed = true;
      } else {
        this.logger.log(`Collection not found for: ${contract_key}`);
        txResult.missing = true;
      }
    } else {
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateCollectionBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
