import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType } from 'src/indexers/common/helpers/indexer-enums';
import { SmartContractService } from 'src/indexers/common/helpers/smart-contract.service';
import { CreateBidStateArgs, TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateSoloBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class SoloIdBidIndexerService implements IndexerService {
  private readonly logger = new Logger(SoloIdBidIndexerService.name);
  readonly marketScs?: SmartContract[];

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    private txActionService: TxActionService,
    private scService: SmartContractService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id');    
    const events = this.stacksTxHelper.extractSmartContractLogEvents(tx.events);
    const event = events.find(e => e && e.data?.data && e.data.data['collection-id']);

    if (event) {
      const market_contract_key = event.contract_log.contract_id;
      const { offer, buyer } = event.data.data;
      const contract_key = this.stacksTxHelper.extractContractKeyFromEvent(event);
      const bid_sc = await this.scService.readOrFetchByKey(market_contract_key, sc.chain_id, this.marketScs);

      if (contract_key && bid_sc) {
        const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

        const bidCommonArgs = this.stacksTxHelper.setCommonBidArgs(
          tx, bid_sc, event, nftMeta.collection, BidType.solo
        );
        const collectionBidArgs: CreateBidStateArgs = {
          ... bidCommonArgs,
          bid_price: offer,
          bid_buyer: buyer
        };
        await this.txBidHelper.createSoloBid(collectionBidArgs, token_id);

        const actionCommonArgs = this.txHelper.setCommonActionParams(
          ActionName.solo_bid, tx, nftMeta, sc
        );
        const acceptBidActionParams: CreateSoloBidActionTO = {
          ...actionCommonArgs,
          bid_price: offer,
          buyer: buyer
        };
  
        await this.createAction(acceptBidActionParams);
        txResult.processed = true;
      } else if (!contract_key) {
        this.logger.warn(`Unable to extract contract_key from event`);
        txResult.missing = true;
      } else if (!bid_sc) {
        this.logger.warn(`Unable to find bid marketplace ${market_contract_key} from event`);
        txResult.missing = true;
      }
    } else {
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateSoloBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
  
}
