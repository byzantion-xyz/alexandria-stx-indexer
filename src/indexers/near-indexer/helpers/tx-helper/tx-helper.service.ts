import { Injectable, Logger } from '@nestjs/common';
import { NftState } from '@prisma/client';
import { Block, Transaction } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class TxHelperService {
  private readonly logger = new Logger(TxHelperService.name);

  constructor(
    private readonly prismaService: PrismaService
  ) {}

  isNewNftListOrSale(tx: Transaction, nft_state: NftState, block: Block) {
    return !nft_state.list_block_height ||
      block.block_height > nft_state.list_block_height ||
      (block.block_height === nft_state.list_block_height && tx.transaction.nonce > nft_state.list_tx_index);
  }

  parseBase64Arguments(tx: Transaction) {
    try {
      return JSON.parse(Buffer.from(tx.transaction.actions[0].FunctionCall.args, 'base64').toString());
    } catch (err) {
      this.logger.warn('parseBase64Arguments() failed. ', err);
      throw err;
    }
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

  async unlistMeta(nftMetaId: string, nonce: bigint, block_height: bigint) {
    let update = {
      listed: false,
      list_price: null,
      list_seller: null,
      list_contract_id: null,
      list_tx_index: tx.transaction.nonce,
      list_block_height: block.block_height
    };

    return await this.prismaService.nftMeta.update({
      where: { id: nftMetaId },
      data: { nft_state: { update: update }}
    });

  }

}
