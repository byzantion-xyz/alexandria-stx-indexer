import { Injectable } from '@nestjs/common';
import { NftState } from '@prisma/client';
import { Block, Transaction } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class TxHelperService {

  constructor(
    private readonly prismaService: PrismaService
  ) {}

  isNewNftListOrSale(tx: Transaction, nft_state: NftState, block: Block) {
    return !nft_state.list_block_height ||
      block.block_height > nft_state.list_block_height ||
      (block.block_height === nft_state.list_block_height && tx.transaction.nonce > nft_state.list_tx_index);
  }

  async findMetaByContractKey(contract_key: string, token_id: string) {
    const nft_smart_contract = await this.prismaService.smartContract.findUnique({ 
      where: { contract_key },
      select: {
        nft_metas: {
          where: {
            token_id: token_id
          },
          include: {
            nft_state: true,
            smart_contract: true
          }
        }
      }
    });

    if (nft_smart_contract && nft_smart_contract.nft_metas && 
      nft_smart_contract.nft_metas.length === 1) {
      return nft_smart_contract.nft_metas[0];
    }
  }

}
