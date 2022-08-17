import { Injectable, Logger } from "@nestjs/common";
import * as moment from "moment";
import { CreateActionCommonArgs } from "../interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { NftState } from "src/database/universal/entities/NftState";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Collection } from "src/database/universal/entities/Collection";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "./indexer-enums";
import { Commission } from "src/database/universal/entities/Commission";
import { NftStateList } from "src/database/universal/entities/NftStateList";
import { makeContractCall } from "@stacks/transactions";

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
    @InjectRepository(NftStateList)
    private nftStateListRepository: Repository<NftStateList>
  ) {}

  nanoToMiliSeconds(nanoseconds: bigint) {
    return Number(BigInt(nanoseconds) / BigInt(1e6));
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

  // TODO: Optimize relations fetched per event type
  async findMetaByContractKey(contract_key: string, token_id: string) {
    const nft_smart_contract = await this.smartContractRepository.findOne({
      where: {
        contract_key,
        nft_metas: { token_id },
      },
      relations: {
        nft_metas: {
          nft_state: { 
            staked_contract: true,  
            nft_states_list: { commission: true, list_contract: true }
          },
          smart_contract: true,
          collection: true
      }}
    });

    if (nft_smart_contract && nft_smart_contract.nft_metas && nft_smart_contract.nft_metas.length === 1) {
      return nft_smart_contract.nft_metas[0];
    }
  }

  findStateList(nftState: NftState, msc_id: string): NftStateList {
    return nftState?.nft_states_list?.find(s => s.list_contract_id === msc_id);
  }

  async findCommissionByKey(sc: SmartContract, contract_key: string, key?: string): Promise<Commission> {
    if (!key) {
      key = `${sc.contract_key}::${contract_key}`;
    }
    if (key) {
      const commission = await this.commissionRepository.findOneBy({ commission_key: key });
      return commission;
    }
  }

  async unlistMeta(nftMeta: NftMeta, tx: CommonTx, msc: SmartContract): Promise<NftState> {
    let nftStateList = this.nftStateListRepository.create({
      listed: false,
      list_price: null,
      list_seller: null,
      list_contract_id: msc.id,
      list_tx_index: tx.index,
      list_block_height: tx.block_height,
      list_sub_block_seq: tx.sub_block_sequence,
      list_block_datetime: null,
      function_args: null,
      commission_id: null
    });

    return await this.createOrUpsertNftStateList(nftMeta, nftStateList);
  }

  async unlistMetaInAllMarkets(nftMeta: NftMeta, tx: CommonTx, msc: SmartContract, seller?: string) {
    let nftStateList = this.nftStateListRepository.create({
      listed: false,
      list_price: null,
      list_seller: null,
      list_tx_index: tx.index,
      list_block_height: tx.block_height,
      list_sub_block_seq: tx.sub_block_sequence,
      list_block_datetime: null,
      function_args: null,
      commission_id: null
    });

   if (nftMeta.nft_state) {
      nftMeta.nft_state.nft_states_list = nftMeta.nft_state.nft_states_list.map(state => {
        return seller && state.list_seller !== seller ? state :
          this.nftStateListRepository.merge(state, nftStateList);
      });

      let alreadyExists = this.findStateList(nftMeta.nft_state, msc.id);
      if (!alreadyExists) {
        nftMeta.nft_state.nft_states_list.push(
          this.nftStateListRepository.create({ ...nftStateList, list_contract_id: msc.id })
        );
      }

      await this.nftStateRepository.save(nftMeta.nft_state);
    } else {
      let nftState = this.nftStateRepository.create();
      nftState.meta_id = nftMeta.id;
      nftState.nft_states_list = [this.nftStateListRepository.merge(nftStateList, { list_contract_id: msc.id })];

      await this.nftStateRepository.save(nftState);
    }
  }

  async createOrUpsertNftStateList(nftMeta: NftMeta, nftStateList: NftStateList): Promise<NftState> {
    if (nftMeta.nft_state) {
      await this.nftStateListRepository.upsert(
        this.nftStateListRepository.merge(nftStateList, { nft_state_id: nftMeta.nft_state.id}),
        ["nft_state_id", "list_contract_id"]
      );
      return nftMeta.nft_state;
    } else {
      let nftState = this.nftStateRepository.create();
      nftState.meta_id = nftMeta.id;
      nftState.nft_states_list = [nftStateList];

      return await this.nftStateRepository.save(nftState);
    }
  }

  // TODO: Refactor parameters
  async listMeta (
    nftMeta: NftMeta, 
    tx: CommonTx, 
    sc: SmartContract, 
    price: bigint, 
    commission_id?: string, 
    args?: NftStateArguments
  ) {
    let nftStateList = this.nftStateListRepository.create({
      listed: true,
      list_price: price,
      list_contract_id: sc.id,
      list_tx_index: tx.index,
      list_seller: tx.signer,
      list_block_height: tx.block_height,
      list_block_datetime: moment(new Date(tx.block_timestamp)).toDate(),
      list_sub_block_seq: tx.sub_block_sequence,
      ... (commission_id && { commission_id }),
      ... (args && { function_args: args }),
    });

    await this.createOrUpsertNftStateList(nftMeta, nftStateList);
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

  async burnMeta(nftMetaId: string) {
    await this.nftStateRepository.upsert({ meta_id: nftMetaId, burned: true }, ["meta_id"]);
  }

  setCommonActionParams(
    action: ActionName, 
    tx: CommonTx, 
    nftMeta: NftMeta, 
    msc?: SmartContract
  ): CreateActionCommonArgs {
    let common =  this.setBasicActionParams(action, tx, msc);
    let params: CreateActionCommonArgs = {
      ...common,
      nft_meta_id: nftMeta.id,
      collection_id: nftMeta.collection_id,
      smart_contract_id: nftMeta.smart_contract.id
    }    
    return params;
  }

  // TODO: Unify setCommonActionParams and setCommonCollectionActionParams
  setCommonCollectionActionParams(
    action: ActionName,
    tx: CommonTx,
    collection: Collection,
    msc?: SmartContract
  ): CreateActionCommonArgs {
    let common =  this.setBasicActionParams(action, tx, msc);
    let params: CreateActionCommonArgs = {
      ...common,
      collection_id: collection.id,
      smart_contract_id: collection.smart_contract_id
    }    
    return params;
  }

  setBasicActionParams(action: ActionName, tx: CommonTx, msc?: SmartContract) {
    return {
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
