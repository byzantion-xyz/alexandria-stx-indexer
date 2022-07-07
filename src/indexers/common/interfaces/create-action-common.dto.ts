import { ActionName as ActionNameTO } from "../helpers/indexer-enums";

export interface CreateActionCommonArgs {
  nft_meta_id: string;
  collection_id: string;
  smart_contract_id: string;
  market_name: string;

  block_height: bigint;
  tx_index: bigint;
  block_time: Date;
  tx_id: string;
}

export interface CreateListActionTO extends CreateActionCommonArgs {
  list_price: bigint;
  action: ActionNameTO;
  seller: string;
}

export interface CreateUnlistActionTO extends CreateListActionTO {}
export interface CreateBuyActionTO extends CreateListActionTO {
  buyer: string;
}

export type CreateActionTO = CreateListActionTO | CreateUnlistActionTO | CreateBuyActionTO;
