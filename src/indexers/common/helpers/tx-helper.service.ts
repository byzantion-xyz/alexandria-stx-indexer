import { Injectable, Logger } from "@nestjs/common";
import * as moment from "moment";
import { CreateActionCommonArgs } from "../interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { NftState } from "src/database/universal/entities/NftState";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName } from "./indexer-enums";
import { Commission } from "src/database/universal/entities/Commission";
import { BidState } from "src/database/universal/entities/BidState";
import { Bid } from "src/database/universal/entities/Bid";

export interface NftStateArguments {
  collection_map_id?: string
}

// TODO: Refactor nft_state changes into unified service

@Injectable()
export class TxHelperService {
  private readonly logger = new Logger(TxHelperService.name);

  constructor(
    @InjectRepository(NftState)
    private nftStateRepository: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(Bid)
    private bidRepository: Repository<Bid>
  ) {}

  nanoToMiliSeconds(nanoseconds: bigint) {
    return Number(BigInt(nanoseconds) / BigInt(1e6));
  }
  
  isNewNftListOrSale(tx: CommonTx, nft_state: NftState) {
    return (
      !nft_state ||
      !nft_state.list_block_height ||
      tx.block_height > nft_state.list_block_height ||
      (tx.block_height === nft_state.list_block_height && tx.index && tx.index > nft_state.list_tx_index)
    );
  }

  isNewBid(tx: CommonTx, bid_states: BidState[]) {
    return (
      !nft_state ||
      !nft_state.bid_block_height ||
      tx.block_height > nft_state.bid_block_height ||
      (tx.block_height === nft_state.bid_block_height && tx.index && tx.index > nft_state.bid_tx_index)
    );
  }

  extractArgumentData(args: JSON, scf: SmartContractFunction, field: string) {
    if (scf.data && scf.data[field]) {
      // Any data stored directly in smart_contract_function must override arguments
      return scf.data[field];
    }

    const index = scf.args[field];
    if (typeof index === 'undefined') {
      return undefined;
    } if (index.toString().includes(".")) {
      const indexArr = index.toString().split(".");
      return args[indexArr[0]][indexArr[1]];
    } else {
      return args[scf.args[field]];
    }
  }

  async findMetaByContractKey(contract_key: string, token_id: string) {
    const nft_smart_contract = await this.smartContractRepository.findOne({
      where: {
        contract_key,
        nft_metas: { token_id },
      },
      relations: {
        nft_metas: {
          nft_state: { list_contract: true, staked_contract: true },
          smart_contract: true
      }}
    });

    if (nft_smart_contract && nft_smart_contract.nft_metas && nft_smart_contract.nft_metas.length === 1) {
      return nft_smart_contract.nft_metas[0];
    }
  }

  async findMetaBids(nftMeta: NftMeta) {
    const bids: Bid[] = await this.bidRepository.find({
      where: {
        smart_contract_id: nftMeta.smart_contract_id,
        bid_type: 'solo',
        states: { meta_id: nftMeta.id } 
      },
      relations: { states: true }
    });

    return bids;
  }

  async findCollectionBids(collection_id: string) {

  }

  async findCommissionByKey(sc: SmartContract, contract_key: string, key?: string): Promise<string> {
    let commission_id: string;
    if (!key) {
      key = `${sc.contract_key}::${contract_key}`;
    }
    if (key) {
      const commission = await this.commissionRepository.findOneBy({ commission_key: key });
      if (commission) return commission.id;
    }
  }

  async unlistMeta(nftMetaId: string, nonce: bigint, block_height: bigint) {
    let update = {
      listed: false,
      list_price: null,
      list_seller: null,
      list_contract_id: null,
      list_tx_index: nonce,
      list_block_height: block_height,
      function_args: null,
      commission_id: null
    };

    return await this.nftStateRepository.upsert({ meta_id: nftMetaId, ...update }, ["meta_id"]);
  }

  async listMeta (nftMetaId: string, tx: CommonTx, sc: SmartContract,  price: bigint, commission_id?: string, args?: NftStateArguments) {
    let update: any = {
      listed: true,
      list_price: price,
      list_contract_id: sc.id,
      list_tx_index: tx.index,
      list_seller: tx.signer,
      list_block_height: tx.block_height,
      ... (commission_id && { commission_id }),
      ... (args && { function_args: args }),
    };

    await this.nftStateRepository.upsert({ meta_id: nftMetaId, ...update }, ["meta_id"]);
  }
  
  async bidMeta (nftMetaId: string, tx: CommonTx, sc: SmartContract, price: bigint) {
    let update: any = {
      bid: true,
      bid_price: price, 
      bid_contract_id: sc.id,
      bid_buyer: tx.signer,
      bid_block_height: tx.block_height,
      bid_tx_index: tx.index
    };

    await this.nftStateRepository.upsert({ meta_id: nftMetaId, ...update }, ["meta_id"]);
  }

  async unlistBidMeta(nftMetaId: string, tx: CommonTx) {
    let update = {
      bid: false,
      bid_price: null,
      bid_buyer: null,
      bid_contract_id: null,
      bid_tx_index: tx.index,
      bid_block_height: tx.block_height
    };

    return await this.nftStateRepository.upsert({ meta_id: nftMetaId, ...update }, ["meta_id"]);
  }

  async stakeMeta (nftMetaId: string, tx: CommonTx, sc: SmartContract, stake_sc: SmartContract) {
    let update: any = {
      staked: true,
      staked_contract_id: stake_sc?.id || null,
      staked_owner: tx.signer,
      staked_block_height: tx.block_height,
      staked_tx_index: tx.index
    };
    await this.nftStateRepository.upsert({ meta_id: nftMetaId, ...update }, ["meta_id"]);
  }

  async unstakeMeta(nftMetaId: string, tx: CommonTx) {
    let update: any = {
      staked: false,
      staked_contract_id: null,
      staked_owner: null,
      staked_block_height: tx.block_height,
      staked_tx_index: tx.index
    };
    await this.nftStateRepository.upsert({ meta_id: nftMetaId, ...update }, ["meta_id"]);
  }

  setCommonActionParams(
    action: ActionName,
    tx: CommonTx,
    sc: SmartContract,
    nftMeta: NftMeta,
    msc?: SmartContract
  ): CreateActionCommonArgs {

    return {
      nft_meta_id: nftMeta.id,
      smart_contract_id: sc.id,
      collection_id: nftMeta.collection_id,
      block_height: tx.block_height,
      action: action,
      tx_index: tx.index,
      nonce: tx.nonce,
      block_time: moment(new Date(tx.block_timestamp)).toDate(),
      tx_id: tx.hash,
      ...(msc && {
        market_name: msc.name,
        marketplace_smart_contract_id: msc.id,
      }),
    };
  }
}
