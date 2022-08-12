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
import { CreateActionTO, CreateMultiAttributeBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class MultiIdBidIndexerService implements IndexerService {
  private readonly logger = new Logger(MultiIdBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id_list = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id_list');    
    const events = this.stacksTxHelper.extractSmartContractLogEvents(tx.events);

    for (let event of events) {
      if (event && event.data?.data && event.data.data['collection-id']) {
        const contract_key = this.stacksTxHelper.extractContractKeyFromEvent(event);
        const collection = await this.collectionRepository.findOne({ where: { smart_contract: { contract_key }}});
        const bid_sc = await this.smartContractRepository.findOne({ where: { contract_key: event.contract_log.contract_id }});
        const trait = JSON.parse(event.data.trait);

        if (contract_key && collection && bid_sc) {
          const bidCommonArgs = this.txBidHelper.setCommonBidArgs(
            tx, bid_sc, event, collection, BidType.attribute
          );
          const collectionBidArgs: CreateCollectionBidStateArgs = {
            ... bidCommonArgs,
            bid_price: event.data.data.offer,
            bid_buyer: event.data.data.buyer
          };
          await this.txBidHelper.createTokenIdsBid(collectionBidArgs, token_id_list, trait);
        }
      }
    }

    const contract_key = this.stacksTxHelper.extractAndParseContractKey(tx.args, scf, 'collection_map_id');
    const price = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'bid_price');
    const units = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'units');

    const collection = await this.collectionRepository.findOne({ 
      where: { smart_contract: { contract_key }}
    });

    if (collection) {
      const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
        ActionName.multi_attribute_bid, tx, collection, sc
      );
      const acceptBidActionParams: CreateMultiAttributeBidActionTO = {
        ...actionCommonArgs,
        bid_price: price,
        buyer: tx.signer,
        units: units
      };
  
      await this.createAction(acceptBidActionParams);
    }
    txResult.processed = true;

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
