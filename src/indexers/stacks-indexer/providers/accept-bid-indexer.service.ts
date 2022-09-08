import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType } from 'src/indexers/common/helpers/indexer-enums';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateAcceptBidActionTO, CreateActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class AcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(AcceptBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    if (!this.stacksTxHelper.isByzOldMarketplace(sc)) {
      txResult.missing = true;
      return txResult;
    }

    const contract_key = this.stacksTxHelper.extractAndParseContractKey(tx.args, scf);
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id'); 

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      let bidState = await this.txBidHelper.findActiveBid(nftMeta.collection.id, BidType.solo, nftMeta.id);

      if (bidState && this.txBidHelper.isNewBid(tx, bidState)) {
        await this.txBidHelper.acceptSoloBid(bidState, tx);

        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, sc, bidState.bid_seller);

        const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.accept_bid, tx, nftMeta, sc);
        const acceptBidActionParams: CreateAcceptBidActionTO = {
          ...actionCommonArgs,
          bid_price: bidState?.bid_price,
          buyer: bidState?.bid_buyer,
          seller: tx.signer
        };
        await this.createAction(acceptBidActionParams);
        txResult.processed = true;
      } else if (bidState) {
        this.logger.log(`Too Late`); 
        txResult.processed = true;  
      } else {
        this.logger.log(`bid_state not found`);
        txResult.missing = true;        
      }

      
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
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
