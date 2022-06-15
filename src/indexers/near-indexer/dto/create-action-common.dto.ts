import { ActionName } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime';

export interface CreateActionCommonArgs {
    nft_meta_id: string
    collection_id: string
    smart_contract_id: string
    market_name: string
  
    block_height: bigint
    tx_index: bigint
    block_time: Date
    tx_id: string
  }

  export interface CreateListAction extends CreateActionCommonArgs {
    list_price: Decimal
    action: ActionName
    seller: string
  }
  export interface CreateUnlistAction extends CreateListAction { }
  export interface CreateBuyAction extends CreateListAction {
    buyer: string
  }