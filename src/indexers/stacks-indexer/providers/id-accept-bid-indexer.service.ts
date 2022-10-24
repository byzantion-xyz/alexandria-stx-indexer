import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { BidState } from 'src/database/universal/entities/BidState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, CollectionBidStatus } from 'src/indexers/common/helpers/indexer-enums';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateAcceptBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class IdAcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(IdAcceptBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    private txActionService: TxActionService,
    @InjectRepository(BidState)
    private bidStateRepository: Repository<BidState>
  ) { }

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const events = this.stacksTxHelper.extractSmartContractLogEvents(tx.events);
    const event = events.find(e => e && e.data?.data && e.data.order && e.data.data['item-id']);

    if (event) {
      const token_id: bigint = event.data.data['item-id'];
      const order = event.data.order;
      const bid_contract_nonce = this.stacksTxHelper.build_nonce(sc.contract_key, order);
      const bidState = await this.bidStateRepository.findOne({
        where: { bid_contract_nonce },
        relations: { collection: { smart_contract: true } }
      });

      if (bidState && bidState.status !== CollectionBidStatus.matched) {
        const { contract_key } = bidState.collection.smart_contract;
        const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, Number(token_id).toString(), sc.chain_id);

        await this.txBidHelper.acceptBid(bidState, tx, nftMeta);
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, sc, bidState.bid_seller);

        const actionCommonArgs = this.txHelper.setCommonCollectionActionParams(
          ActionName.accept_attribute_bid, tx, bidState.collection, sc
        );
        const acceptBidActionParams: CreateAcceptBidActionTO = {
          ...actionCommonArgs,
          nonce: BigInt(bidState.nonce),
          bid_price: bidState.bid_price,
          buyer: bidState.bid_buyer,
          seller: bidState.bid_seller
        };

        await this.createAction(acceptBidActionParams);

      } else if (bidState) {
        this.logger.log(`Attribute bid already "${bidState.status}" with nonce: ${bidState.nonce}`);
        txResult.processed = true;
      } else {
        this.logger.log(`bid_state not found bid_contract_nonce: ${bid_contract_nonce}`);
      }

    } else {
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateAcceptBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
