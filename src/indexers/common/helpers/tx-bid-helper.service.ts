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
import { In, IsNull, Repository } from 'typeorm';
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
export interface CreateBidStateArgs extends CreateBidCommonArgs {
  bid_buyer: string;
};

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

  async createOrReplaceBid(params: CreateCollectionBidStateArgs, bidState?: BidState, nftMetaId?: string): Promise<BidState> {
    try {
      if (bidState) {
        bidState = this.bidStateRepo.merge(bidState, params);
      } else {
        bidState = this.bidStateRepo.create(params);
        if (nftMetaId) {
          const bidStateNftMeta = new BidStateNftMeta();
          bidStateNftMeta.meta_id = nftMetaId;
          bidState.nft_metas = [bidStateNftMeta];
        }
      }
      const saved = await this.bidStateRepo.save(bidState);

      this.logger.log(`New bid_state bid_type:${params.bid_type}  id: ${saved.id} `);

      return saved;
    } catch (err) {} 
  }

  isNewBid(tx: CommonTx, bidState: BidState): boolean {
    return (
      !bidState ||
      !bidState.block_height ||
      tx.block_height > bidState.block_height ||
      (tx.block_height === bidState.block_height && tx.index && tx.index > bidState.tx_index)
    );
  }

  async findActiveBid(collectionId: string, bid_type: BidType, nftMetaId?: string) {
    return await this.bidStateRepo.findOne({
      where: {
        collection_id: collectionId,
        bid_type: bid_type,
        status: CollectionBidStatus.active,
        nonce: IsNull(),
        bid_contract_nonce: IsNull(),
        ... (nftMetaId &&  { nft_metas: { meta_id: nftMetaId }})
      }
    });
  }

  async createTokenIdsBid(params: CreateAttributeBidStateArgs, token_ids: [string], trait?: [any]): Promise<BidState> {
    const bidState = this.bidStateRepo.create(params);
    bidState.nft_metas = [];
    bidState.attributes = [];
    return await this.setTokenIdsAndAttributes(bidState, token_ids, trait);
  }
  
  async setTokenIdsAndAttributes(bidState: BidState, token_ids: [string], trait?: [any]): Promise<BidState> {
    try {
      const nftMetas = await this.nftMetaRepo.find({ where: { 
        collection_id: bidState.collection_id, token_id: In(token_ids) } 
      });

      for (let meta of nftMetas) {
        const bidStateNftMeta = new BidStateNftMeta();
        bidStateNftMeta.meta_id = meta.id;
        bidState.nft_metas.push(bidStateNftMeta);
      }
  
      if (trait && trait.length) {
        for (let attr of trait) {
          const bid_attribute = new BidAttribute();
          const collectionAttribute = await this.collectionAttributeRepo.findOne({ where: { 
            collection_id: bidState.collection_id, 
            trait_type: attr.trait_type,
            value: attr.value
          }});
          bid_attribute.collection_attribute_id = collectionAttribute.id;
          bidState.attributes.push(bid_attribute);
        }
      }
      const saved = await this.bidStateRepo.save(bidState);

      this.logger.log(`New bid_state bid_type: ${bidState.bid_type} id: ${saved.id} `);

      return saved;
    } catch (err) {}
  }

  async upsertTokenIdsBid(params: CreateAttributeBidStateArgs, bidState: BidState, token_ids: [string], trait?: any[]) {
    if (!bidState) {
      bidState = this.bidStateRepo.create(params);
    } else {
      bidState = this.bidStateRepo.merge(bidState, params);
    }
  }

  async createSoloBid(params: CreateAttributeBidStateArgs, token_id: string) {
    return await this.createTokenIdsBid(params, [token_id]);
  }

  async findBidStateByNonce(nonce: string): Promise<BidState> {
    return await this.bidStateRepo.findOne({
      where: { bid_contract_nonce: nonce },
      relations: { 
        collection: { smart_contract: true },
        nft_metas: { meta: true }
      }
    });
  }

  async findSoloBidStateByNonce(nonce: string): Promise<BidState> {
    return await this.bidStateRepo.findOne({
      where: { bid_contract_nonce: nonce, bid_type: BidType.solo },
      relations: { 
        nft_metas: { meta: { collection: true, smart_contract: true } }
      }
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

  setCommonV6BidArgs(
    tx: CommonTx,
    sc: SmartContract,
    collection: Collection,
    type: BidType,
    price: number
  ): CreateBidCommonArgs {
    return {
      smart_contract_id: sc.id,
      collection_id: collection.id,
      nonce: null,
      bid_contract_nonce: null,
      bid_price: BigInt(price),
      tx_id: tx.hash,
      tx_index: tx.index,
      block_height: tx.block_height,
      bid_type: type,
      status: CollectionBidStatus.active
    };
  }

  async acceptSoloBid(bidState: BidState, tx: CommonTx) {
    try {
      await this.bidStateRepo.update({ id: bidState.id }, {
        status: CollectionBidStatus.matched,
        bid_seller: tx.signer,
        match_tx_id: tx.hash
      });

      this.logger.log(`Accept solo bid nonce: ${bidState.nonce || 'unknown' }`);
    } catch (err) {
      this.logger.warn('Error saving solo bid acceptance ', bidState.nonce, err);
    }
  }

  async acceptBid(bidState: BidState, tx: CommonTx, nftMeta: NftMeta) {
    try {
      bidState.status = CollectionBidStatus.matched;
      bidState.bid_seller = tx.signer;
      bidState.match_tx_id = tx.hash;
      const bidStateNftMeta = new BidStateNftMeta();
      bidStateNftMeta.meta_id = nftMeta.id;
      bidState.nft_metas = [bidStateNftMeta];

      await this.bidStateRepo.save(bidState);
      this.logger.log(`Accept bid nonce: ${bidState.nonce || 'unknown' }`);
    } catch (err) { 
      this.logger.warn(`Error saving bid acceptance nonce: ${bidState.nonce} `, err); 
    }
  }

  async cancelBid(bidState: BidState, tx: CommonTx) {
    try {
      await this.bidStateRepo.update({ id: bidState.id }, {
        status: CollectionBidStatus.cancelled,
        cancel_tx_id: tx.hash
      });
      
      this.logger.log(`Cancelled bid nonce: ${bidState.nonce || 'Unknown'} `);
    } catch (err) {
      this.logger.warn('Error saving cancellation with nonce: ', bidState.nonce || 'Unknown', err);
    }
  }

  build_nonce(contract_key: string, order: bigint): string {
    return `${contract_key}::${order.toString()}`;
  }

}
