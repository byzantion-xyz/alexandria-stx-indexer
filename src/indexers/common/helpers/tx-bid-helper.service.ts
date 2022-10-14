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

export interface CreateBidStateArgs extends CreateBidCommonArgs {
  bid_buyer: string;
};

export interface CreateCollectionBidStateArgs extends CreateBidStateArgs {}
export interface CreateAttributeBidStateArgs extends CreateBidStateArgs {};

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

  async createOrReplaceBid(params: CreateBidStateArgs, bidState?: BidState, nftMetaId?: string): Promise<BidState> {
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

      this.logger.log(`New bid_state bid_type:${params.bid_type} id: ${saved.id}`);

      return saved;
    } catch (err) { 
      this.logger.warn(err); 
      throw err;
    }
  }

  isNewBid(tx: CommonTx, bidState: BidState): boolean {
    return (
      !bidState ||
      !bidState.block_height ||
      tx.block_height > bidState.block_height ||
      (tx.block_height === bidState.block_height && tx.index && tx.index > bidState.tx_index)
    );
  }

  async findActiveSoloBid(nftMeta: NftMeta, buyer?: string): Promise<BidState> {
    return await this.bidStateRepo.findOne({
      where: {
        collection_id: nftMeta.collection_id,
        bid_type: BidType.solo,
        status: CollectionBidStatus.active,
        nonce: IsNull(),
        bid_contract_nonce: IsNull(),
        nft_metas: { meta_id: nftMeta.id },
        ...(buyer && { bid_buyer: buyer })
      }
    });
  }

  async findActiveCollectionBid(collectionId: string): Promise<BidState> {
    return await this.bidStateRepo.findOne({
      where: {
        collection_id: collectionId,
        bid_type: BidType.collection,
        status: CollectionBidStatus.active,
        nonce: IsNull(),
        bid_contract_nonce: IsNull()
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

  setCommonBidArgs(
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

}
