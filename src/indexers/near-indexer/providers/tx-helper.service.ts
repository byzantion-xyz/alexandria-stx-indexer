import { Injectable, Logger } from '@nestjs/common';
import { ActionName, NftMeta, NftState, SmartContract } from '@prisma/client';
import { Block, Transaction } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { Action, CreateAccount } from 'near-api-js/lib/transaction';
import moment from 'moment';
import { DiscordBotDto } from 'src/discord-bot/dto/discord-bot.dto';

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
  list_price: bigint
  action: ActionName
  seller: string
}
export interface CreateUnlistAction extends CreateListAction { }
export interface CreateBuyAction extends CreateListAction {
  buyer: string
}

@Injectable()
export class TxHelperService {
  private readonly logger = new Logger(TxHelperService.name);

  constructor(
    private readonly prismaService: PrismaService
  ) { }

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
      list_tx_index: nonce,
      list_block_height: block_height
    };

    return await this.prismaService.nftMeta.update({
      where: { id: nftMetaId },
      data: { nft_state: { update: update } }
    });
  }

  setCommonActionParams(tx: Transaction, block: Block, sc: SmartContract, nftMeta: NftMeta): CreateActionCommonArgs {
    return {
      nft_meta_id: nftMeta.id,
      smart_contract_id: sc.id,
      collection_id: nftMeta.collection_id,
      market_name: sc.name,
      block_height: block.block_height,
      tx_index: tx.transaction.nonce,
      block_time: moment().toDate(), // TODO: Use block timestamp
      tx_id: tx.transaction.hash,
    }
  }
}