import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { Collection } from 'src/database/universal/entities/Collection';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType } from 'src/indexers/common/helpers/indexer-enums';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateUnlistCollectionBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class CollectionUnlistBidIndexerService implements IndexerService {
  private readonly logger = new Logger(CollectionUnlistBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
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

    const collection = await this.collectionRepository.findOne({ where: { 
      smart_contract: { contract_key }
    }})

    if (collection) {
      let bidState = await this.txBidHelper.findActiveBid(collection.id, BidType.collection);

      if (bidState && this.txBidHelper.isNewBid(tx, bidState)) {
        this.txBidHelper.cancelBid(bidState, tx);

        const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
          ActionName.unlist_collection_bid, tx, collection, sc
        );
        const actionParams: CreateUnlistCollectionBidActionTO = {
          ...actionCommonArgs,
          buyer: tx.signer
        };
        await this.createAction(actionParams);
        txResult.processed = true;
      } else if (bidState) {
        this.logger.log(`Too Late Unlist Bid ${tx.hash}`);
        txResult.processed = true;
      } else {
        this.logger.log(`bid_state not found for collection: ${collection.slug}`);
        txResult.missing = true;
      }
    } else {
      this.logger.log(`Missing Collection Unlist Bid ${contract_key} ${tx.hash}`);
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
