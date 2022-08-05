import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEventSmartContractLog } from '@stacks/stacks-blockchain-api-types';
import { BidAttribute } from 'src/database/universal/entities/BidAttribute';
import { BidState } from 'src/database/universal/entities/BidState';
import { BidStateNftMeta } from 'src/database/universal/entities/BidStateNftMeta';
import { CollectionAttribute } from 'src/database/universal/entities/CollectionAttribute';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { Collection } from 'src/database/universal/entities/Collection';
import { TransactionEventSmartContractLogWithData } from 'src/indexers/stacks-indexer/providers/stacks-tx-helper.service';
import { In, Repository } from 'typeorm';
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
  collection_id: string;
}

export interface CreateCollectionBidStateArgs extends CreateBidCommonArgs {
  bid_buyer: string;
}

export interface CreateAttributeBidStateArgs extends CreateCollectionBidStateArgs {};

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
    @InjectRepository(NftMeta)
    private nftMetaRepo: Repository<NftMeta>,
    @InjectRepository(CollectionAttribute)
    private collectionAttributeRepo: Repository<CollectionAttribute>,
  ) {}

  async createBid(params: CreateCollectionBidStateArgs): Promise<BidState> {
    try {
      const action = this.bidStateRepo.create(params);
      const saved = await this.bidStateRepo.save(action);

      this.logger.log(`New Bid: ${params.bid_type}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }

  async createAttributeBid(params: CreateAttributeBidStateArgs, token_ids: [string], trait: any[]): Promise<BidState> {
    try {
      const bidState = this.bidStateRepo.create(params);
      
      const nftMetas = await this.nftMetaRepo.find({ where: { token_id: In(token_ids) } });
      for (let meta of nftMetas) {
        const bidStateNftMeta = new BidStateNftMeta();
        bidStateNftMeta.meta_id = meta.id;
        bidState.nft_metas.push(bidStateNftMeta);
      }
  
      for (let attr of trait) {
        const bid_attribute = new BidAttribute();
        const collectionAttribute = await this.collectionAttributeRepo.findOne({ where: { 
          collection_id: params.collection_id, 
          trait_type: attr.trait_type,
          value: attr.value
        }});
        bid_attribute.collection_attribute_id = collectionAttribute.id;
        bidState.attributes.push(bid_attribute);
      }

      const saved = await this.bidStateRepo.save(bidState);

      this.logger.log(`New attribute Bid: ${params.bid_type}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }

  async findBidStateByNonce(nonce: string): Promise<BidState> {
    return await this.bidStateRepo.findOne({
      where: { bid_contract_nonce: nonce },
      relations: { collection: { smart_contract: true }}
    });
  }

  setCommonBidArgs(
    tx: CommonTx, 
    sc: SmartContract, 
    e: TransactionEventSmartContractLogWithData,
    collection: Collection,
    type: BidType
  ): CreateBidCommonArgs {
    return {
      smart_contract_id: sc.id,
      collection_id: collection.id,
      nonce: Number(e.data.order),
      bid_contract_nonce: this.build_nonce(e.contract_log.contract_id, e.data.order),
      bid_price: e.data.data.offer,
      tx_id: tx.hash,
      tx_index: tx.index,
      block_height: tx.block_height,
      bid_type: type,
      status: CollectionBidStatus.active
    };
  }

  async acceptCollectionBid(bidState: BidState, tx: CommonTx, nftMeta: NftMeta) {
    try {
      bidState.status = CollectionBidStatus.matched;
      bidState.bid_seller = tx.signer;
      bidState.match_tx_id = tx.hash;
      const bidStateNftMeta = new BidStateNftMeta();
      bidStateNftMeta.meta_id = nftMeta.id;
      bidState.nft_metas = [bidStateNftMeta];
    
      await this.bidStateRepo.save(bidState);
      this.logger.log(`Accept bid order: ${bidState.nonce}`);
    } catch (err) { this.logger.warn('Error saving acceptance', bidState.nonce, err); }
  }

  async cancelCollectionBid(bidState: BidState, tx: CommonTx) {
    try {
      bidState.status = CollectionBidStatus.cancelled;
      bidState.cancel_tx_id = tx.hash;

      await this.bidStateRepo.save(bidState);
      this.logger.log(`Cancelled bid order: ${bidState.nonce} `);
    } catch (err) {
      this.logger.warn('Error saving cancellation ', bidState.nonce, err);
    }
  }

  build_nonce(contract_key: string, order: bigint): string {
    return `${contract_key}::${Number(order)}`;
  }

}
