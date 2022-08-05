import { ActionName as ActionNameTO } from "../helpers/indexer-enums";

export interface CreateActionCommonArgs {
  nft_meta_id?: string;
  collection_id: string;
  smart_contract_id: string;
  market_name: string;
  action: ActionNameTO;
  block_height: bigint;
  tx_index?: bigint;
  nonce: bigint;
  block_time: Date;
  tx_id: string;
}

export interface CreateListActionTO extends CreateActionCommonArgs {
  list_price: bigint;
  seller: string;
  commission_id?: string;
}
export interface CreateUnlistActionTO extends CreateListActionTO {}
export interface CreateRelistActionTO extends CreateListActionTO {}

export interface CreateBuyActionTO extends CreateListActionTO {
  buyer: string;
}

export interface CreateTransferActionTO extends CreateActionCommonArgs {
  buyer: string;
  seller: string;
}

export interface CreateStakeActionTO extends CreateActionCommonArgs {
  seller: string;
}
export interface CreateUnstakeActionTO extends CreateStakeActionTO {}

export interface CreateBidActionTO extends CreateActionCommonArgs {
  bid_price: bigint;
  buyer: string;
}
export interface CreateUnlistBidActionTO extends CreateBidActionTO {}

export interface CreateAcceptBidActionTO extends CreateBidActionTO {
  seller: string;
}

export interface CreateCollectionBidActionTO extends CreateBidActionTO {}
export interface CreateAcceptCollectionBidActionTO extends CreateBidActionTO {
  seller: string;
}
export interface CreateCancelCollectionBidActionTO extends CreateBidActionTO {};
export interface CreateCollectionMultiOrderBookBidActionTO extends CreateBidActionTO {
  units: number
};

export interface CreateIdBidActionTO extends CreateBidActionTO {
  units: number
};



export type CreateActionTO = CreateListActionTO | 
  CreateUnlistActionTO | 
  CreateBuyActionTO | 
  CreateTransferActionTO |
  CreateStakeActionTO |
  CreateUnstakeActionTO |
  CreateRelistActionTO |
  CreateBidActionTO |
  CreateUnlistBidActionTO |
  CreateAcceptBidActionTO |
  CreateCollectionBidActionTO |
  CreateAcceptCollectionBidActionTO ;
