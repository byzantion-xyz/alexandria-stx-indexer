import { Injectable } from '@nestjs/common';
import { NftState } from '@prisma/client';
import { Block, Transaction } from '@internal/prisma/client';

@Injectable()
export class TxHelperService {

  isNewNftListOrSale(tx: Transaction, nft_state: NftState, block: Block) {
    return !nft_state.list_block_height ||
      block.block_height > nft_state.list_block_height ||
      (block.block_height === nft_state.list_block_height && tx.transaction.nonce > nft_state.list_tx_index);
  }

}
