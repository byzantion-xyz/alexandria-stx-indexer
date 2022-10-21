import { Injectable, Logger } from "@nestjs/common";
import * as moment from "moment";
import { CreateActionCommonArgs } from "../interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { InjectRepository } from "@nestjs/typeorm";
import { NftState } from "src/database/universal/entities/NftState";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { Collection } from "src/database/universal/entities/Collection";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "./indexer-enums";
import { Commission } from "src/database/universal/entities/Commission";
import { NftStateList } from "src/database/universal/entities/NftStateList";
import { CommonUtilService } from "src/common/helpers/common-util/common-util.service";

export interface NftStateArguments {
  collection_map_id?: string
}

@Injectable()
export class TxHelperService {
  private readonly logger = new Logger(TxHelperService.name);

  constructor(
    @InjectRepository(NftState)
    private nftStateRepository: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(NftStateList)
    private nftStateListRepository: Repository<NftStateList>,
    private commonUtil: CommonUtilService 
  ) {}

  nanoToMiliSeconds(nanoseconds: bigint) {
    return Number(BigInt(nanoseconds) / BigInt(1e6));
  }

  async findMetaByContractKey(contract_key: string, token_id: string): Promise<NftMeta> {
    const nftMetas = await this.nftMetaRepository.find({
      where: { smart_contract: { contract_key }, token_id },
      relations: {
        nft_state: { 
          staked_contract: true,  
          nft_states_list: { commission: true, list_contract: true }
        },
        smart_contract: true,
        collection: true
      }
    });

    if (nftMetas && nftMetas.length === 1) {
      return nftMetas[0];
    } else if (nftMetas && nftMetas.length > 1) {
      throw new Error(`Unable to find unique meta for: ${contract_key} ${token_id}`);
    }
  }

  async createOrFetchMetaByContractKey(contract_key: string, token_id: string, chain_id: string): Promise<NftMeta> {
    if (!contract_key || !token_id || !chain_id) {
      throw new Error(`invalid parameters ${contract_key} ${token_id} ${chain_id}`);
    }

    let nftMeta = await this.findMetaByContractKey(contract_key, token_id);

    if (!nftMeta) {
      let smartContract = await this.smartContractRepository.findOne({
        where: { contract_key }, 
        relations: { collections: true }
      });
      let collection: Collection;

      if (!smartContract) {
        smartContract = await this.createSmartContractSkeleton(contract_key, chain_id);
      } else if (!smartContract.custodial_smart_contract_id && smartContract.collections.length === 1) {
        collection = smartContract.collections[0];
      }

      nftMeta = await this.createMetaSkeleton(smartContract, token_id, collection);
      this.logger.debug(`createOrFetchMetaByContractKey() created nft_meta for ${contract_key} ${token_id}`);
      nftMeta.smart_contract = smartContract;
    }

    if (!nftMeta) {
      throw new Error(`Unable to fetch nft_meta for ${contract_key} ${token_id}`);
    }

    return nftMeta;
  }

  async createSmartContractSkeleton(contract_key: string, chain_id: string): Promise<SmartContract> {
    this.logger.debug(`createSmartContractSkeleton() contract_key: ${contract_key}`);

    try {
      const smartContract = this.smartContractRepository.create({
        contract_key,
        type: [SmartContractType.non_fungible_tokens],
        chain_id
      });
  
      const saved = await this.smartContractRepository.save(smartContract);
      this.logger.debug(`createSmartContractSkeleton() added smart_contract skeleton for ${contract_key}`);
      return saved;
    } catch (err) {
      this.logger.warn(`createSmartContractSkeleton() failed for contract_key: ${contract_key} `);

      if (err && err.constraint && err.constraint === 'smart_contract_contract_key_key') {
        this.logger.debug(`createSmartContractSkeleton() ${contract_key} already created. Fetching...`);
        return await this.smartContractRepository.findOne({ where: { contract_key }});
      }

      this.logger.error(err);
      throw err;
    }
  }

  async createMetaSkeleton(sc: SmartContract, token_id: string, collection?: Collection): Promise<NftMeta> {
    try {
      const newMeta = this.nftMetaRepository.create({
        smart_contract_id: sc.id,
        chain_id: sc.chain_id,
        ... (collection && { collection_id: collection.id }),
        token_id
      });
      
      return await this.nftMetaRepository.save(newMeta);
    } catch (err) {
      this.logger.warn(`createMetaSkeleton() failed for ${sc.contract_key} ${token_id}`);
      this.logger.warn(err);
      throw err;
    }
  }

  findStateList(nftState: NftState, msc_id: string): NftStateList {
    return nftState?.nft_states_list?.find(s => s.list_contract_id === msc_id);
  }

  isListedInAnyMarketplace(nftState: NftState): boolean {
    return nftState?.nft_states_list?.some(s => s.listed === true);
  }

  isListedPreviously(nftState: NftState, tx: CommonTx): boolean {
    return nftState?.nft_states_list?.some((s) => {
      return s.listed === true && s.list_block_height < tx.block_height;
    });
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

  async unlistMetaInAllMarkets(nftMeta: NftMeta, tx: CommonTx, msc?: SmartContract, seller?: string) {
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
        if ((seller && state.list_seller !== seller) || tx.block_height < state.list_block_height) {
          return state;
        } else {
          return this.nftStateListRepository.merge(state, nftStateList);
        }   
      });

      if (msc) {
        let alreadyExists = this.findStateList(nftMeta.nft_state, msc.id);
        if (!alreadyExists) {
          nftMeta.nft_state.nft_states_list.push(
            this.nftStateListRepository.create({ ...nftStateList, list_contract_id: msc.id })
          );
        }
      }

      await this.nftStateRepository.save(nftMeta.nft_state);
    } else if (msc) {
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
    await this.nftStateRepository.upsert({
      meta_id: nftMetaId, 
      burned: true,
      owner: null,
      owner_block_height: null,
      owner_tx_id: null    
    }, ["meta_id"]);
  }

  async mintMeta(nftMeta: NftMeta, tx: CommonTx, owner: string) {
    await this.nftStateRepository.upsert({
      meta_id: nftMeta.id,
      minted: true,
      mint_tx: tx.hash,
      ...((!nftMeta.nft_state || !nftMeta.nft_state.owner) && {
        owner: owner,
        owner_block_height: tx.block_height,
        owner_tx_id: tx.hash
      })
    }, ["meta_id"]);
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
      ... (nftMeta.collection_id && { collection_id: nftMeta.collection_id }),
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
    const tx_index = tx.sub_block_sequence
      ? BigInt(tx.sub_block_sequence.toString() + this.commonUtil.padWithZeros(tx.index, 5)) : tx.index;

    return {
      block_height: tx.block_height,
      action: action,
      tx_index: tx_index,
      nonce: tx.nonce,
      block_time: moment(new Date(tx.block_timestamp)).toDate(),
      tx_id: tx.hash,
      ...(msc && {
        market_name: msc.name,
        marketplace_smart_contract_id: msc.id,
      }),
    };
  }

  isNewOwnerEvent(tx: CommonTx, nft_state: NftState, owner?: string): boolean {
    return (
      !nft_state ||
      !nft_state.owner_block_height ||
      tx.block_height > nft_state.owner_block_height || 
      (tx.block_height === nft_state.owner_block_height && owner && owner !== nft_state.owner)
    );
  }

  async setNewMetaOwner(nftMeta: NftMeta, tx: CommonTx, owner: string) {
    await this.nftStateRepository.upsert({
      meta_id: nftMeta.id,
      owner: owner,
      owner_block_height: tx.block_height,
      owner_tx_id: tx.hash
    }, ["meta_id"]);
  }

}
