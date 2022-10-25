import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { TransactionEvent, TransactionEventNonFungibleAsset, TransactionEventSmartContractLog } from "@stacks/stacks-blockchain-api-types";
import { BufferCV } from "@stacks/transactions";
import { principalCV } from "@stacks/transactions/dist/clarity/types/principalCV";
import { cvToTrueValue, hexToCV, cvToJSON } from "micro-stacks/clarity";
import { CommonUtilService } from "src/common/helpers/common-util/common-util.service";
import { BidState } from "src/database/universal/entities/BidState";
import { Collection } from "src/database/universal/entities/Collection";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { NftState } from "src/database/universal/entities/NftState";
import { NftStateList } from "src/database/universal/entities/NftStateList";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { BidType, CollectionBidStatus } from "src/indexers/common/helpers/indexer-enums";
import { CreateBidCommonArgs } from "src/indexers/common/helpers/tx-bid-helper.service";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { Repository } from "typeorm";
import { StacksTransaction } from "../dto/stacks-transaction.dto";
interface FunctionArgs {
  hex: string;
  repr: string;
  name: string;
  type: string;
}

const NFT_EVENT_TYPE = 'non_fungible_token_asset';

export type TransactionEventSmartContractLogWithData = TransactionEventSmartContractLog & {
  data: {
    trait: string;
    action: string;
    data: any;
    order: bigint;
    type: string;
  };
};

@Injectable()
export class StacksTxHelperService {
  private byzOldMarketplaces: [string];
  private readonly logger = new Logger(StacksTxHelperService.name);

  constructor(
    private commonUtil: CommonUtilService,
    private txHelper: TxHelperService,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    private configService: ConfigService,
    @InjectRepository(BidState)
    private bidStateRepo: Repository<BidState>,
  ) {
    this.byzOldMarketplaces = this.configService.get("indexer.byzOldMarketplaceContractKeys");
  }

  parseHexData(hex: string) {
    let data = hexToCV(hex);
    if (Object.keys(data).includes("buffer")) {
      return (data as BufferCV).buffer.toString();
    } else {
      let json = cvToJSON(data);
      return json.type === "uint" ? Number(json.value) : json.value;
    }
  }

  parseHexArguments(args: FunctionArgs[]) {
    try {
      let result = [];
      for (let arg of args) {
        if (arg.hex) {
          result.push(this.parseHexData(arg.hex));
        }
      }
      return result;
    } catch (err) {
      this.logger.warn("parseHexArguments() failed. ", err);
    }
  }

  extractArgumentData(args: [], scf: SmartContractFunction, field: string) {
    // Any data stored directly in smart_contract_function must override arguments
    if (scf.data && scf.data[field]) {
      return scf.data[field];
    }

    const index = scf.args[field];
    if (typeof index === "undefined") {
      return undefined;
    } else if (!isNaN(index)) {
      return args[index];
    } else {
      return index;
    }
  }

  isNewerEvent(tx: CommonTx, state_list: NftStateList): boolean {
    return (
      !state_list ||
      !state_list.list_block_height ||
      tx.block_height > state_list.list_block_height ||
      (tx.block_height == state_list.list_block_height &&
        typeof tx.index !== 'undefined' &&
        tx.index > state_list.list_tx_index)
    );
  }

  extractSmartContractLogEvents(events: TransactionEvent[]): TransactionEventSmartContractLogWithData[] {
    try {
      let smart_contract_logs: TransactionEventSmartContractLogWithData[] = [];
      for (let e of events) {
        if (e.event_type === "smart_contract_log" && e.contract_log.value.hex) {
          let data: any = cvToTrueValue(hexToCV(e.contract_log.value.hex));
          smart_contract_logs.push({ ...e, data });
        }
      }
      return smart_contract_logs;
    } catch (err) {
      this.logger.warn("extractSmartContractLogEvents() failed.", err);
    }
  }

  isValidWalletAddress(address: string) {
    try {
      principalCV(address);
      return true;
    } catch (err) {
      return false;
    }
  }

  async findMetaBns(name: string, namespace: string, sc_id?: string): Promise<NftMeta> {
    const nft_meta = await this.nftMetaRepository.findOne({
      where: {
        ...(sc_id && { smart_contract_id: sc_id }),
        name: name,
        nft_meta_bns: { namespace },
      },
      relations: {
        nft_meta_bns: true,
        nft_state: true,
        smart_contract: true,
      },
    });

    if (nft_meta && nft_meta.nft_meta_bns) {
      return nft_meta;
    }
  }

  isByzOldMarketplace(sc: SmartContract): boolean {
    return this.byzOldMarketplaces.includes(sc.contract_key);
  }

  extractContractKeyFromEvent(e: TransactionEventSmartContractLogWithData): string {
    return e.data.data["collection-id"].split("::")[0].replace("'", "");
  }

  extractAndParseContractKey(args: [], scf: SmartContractFunction, field: string = "contract_key"): string {
    let contract_key = this.extractArgumentData(args, scf, field);
    if (contract_key.includes(":")) contract_key = contract_key.split(":")[0];
    if (contract_key.includes("'")) contract_key.replace("'", "");

    return contract_key;
  }

  extractNftContractFromEvents(events: Array<any>) {
    const asset_id = this.commonUtil.findByKey(events, "asset_id");
    return asset_id?.split("::")[0];
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

  build_nonce(contract_key: string, order: bigint): string {
    return `${contract_key}::${order.toString()}`;
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

  getNftEvents(tx: StacksTransaction): TransactionEventNonFungibleAsset[] {
    const nftEvents = tx.tx.events.filter(e => e.event_type === NFT_EVENT_TYPE);
    return nftEvents as TransactionEventNonFungibleAsset[];
  }
}
