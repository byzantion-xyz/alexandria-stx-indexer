import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEventSmartContractLog } from '@stacks/stacks-blockchain-api-types';
import { BidState } from 'src/database/universal/entities/BidState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { TransactionEventSmartContractLogWithData } from 'src/indexers/stacks-indexer/providers/stacks-tx-helper.service';
import { Repository } from 'typeorm';
import { CommonTx } from '../interfaces/common-tx.interface';
import { BidType, CollectionBidStatus } from './indexer-enums';

export interface CreateBidCommonArgs {
  nonce: number;
  bid_contract_nonce: string;
  status: CollectionBidStatus;
  tx_id: string;
  tx_index: bigint;
  block_height: bigint;

  bid_type: BidType;
  bid_price: bigint;

  smart_contract_id: string;
}

export interface CreateCollectionBidStateArgs extends CreateBidCommonArgs {
  collection_id: string;
  bid_buyer: string;
}

//bid_buyer: string;
//bid_seller: string;
//math_tx_id: string;
//cancel_tx_id?: string;
//pending_txs: string[];
//pending_tx: string[];

@Injectable()
export class TxBidHelperService {
  private readonly logger = new Logger(TxBidHelperService.name);

  constructor(
    @InjectRepository(BidState)
    private bidStateRepo: Repository<BidState>,
  ) {}

  async createBid(params: CreateCollectionBidStateArgs): Promise<BidState> {
    try {
      const action = this.bidStateRepo.create(params);
      const saved = await this.bidStateRepo.save(action);

      this.logger.log(`New Bid: ${params.bid_type}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }

  setCommonBidArgs(
    tx: CommonTx, 
    sc: SmartContract, 
    e: TransactionEventSmartContractLogWithData,
    status: CollectionBidStatus,
    type: BidType
  ): CreateBidCommonArgs {
    return {
      smart_contract_id: sc.id,
      nonce: Number(e.data.order),
      bid_contract_nonce: `${e.contract_log.contract_id}::${Number(e.data.order)}`,
      bid_price: e.data.data.offer,
      tx_id: tx.hash,
      tx_index: tx.index,
      block_height: tx.block_height,
      bid_type: type,
      status: status
    };
  }

}
