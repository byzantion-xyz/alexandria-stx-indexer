import { Injectable, Logger } from '@nestjs/common';
import { NftMeta, NftState, SmartContract, SmartContractFunction } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as moment from 'moment';
import { CreateActionCommonArgs } from '../interfaces/create-action-common.dto';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';

@Injectable()
export class TxHelperService {
  private readonly logger = new Logger(TxHelperService.name);

  constructor(
    private readonly prismaService: PrismaService
  ) { }

  nanoToMiliSeconds(nanoseconds: bigint) {
    return Number(BigInt(nanoseconds) / BigInt(1e6));
  }

  isNewNftListOrSale(tx: CommonTx, nft_state: NftState) {
    return !nft_state || !nft_state.list_block_height ||
      tx.block_height > nft_state.list_block_height ||
      (tx.block_height === nft_state.list_block_height && tx.nonce > nft_state.list_tx_index);
  }

  extractArgumentData(args: JSON, scf: SmartContractFunction, field: string) {
    const index = scf.args[field];
    if (!index) {
      return undefined;
    } else if (index.includes('.')) {
      const indexArr = index.split('.');
      return args[indexArr[0]][indexArr[1]];
    } else {
      return args[scf.args[field]];
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
      list_price: undefined,
      list_seller: null,
      list_contract: undefined,
      list_tx_index: nonce,
      list_block_height: block_height
    };

    return await this.prismaService.nftMeta.update({
      where: { id: nftMetaId },
      data: { nft_state: { upsert: { create: update, update: update } }}
    });
  }

  setCommonActionParams(tx: CommonTx, sc: SmartContract, nftMeta: NftMeta, msc?: SmartContract): CreateActionCommonArgs {
    return {
      nft_meta_id: nftMeta.id,
      smart_contract_id: sc.id,
      collection_id: nftMeta.collection_id,
      block_height: tx.block_height,
      tx_index: tx.nonce,
      block_time: moment(new Date(this.nanoToMiliSeconds(tx.block_timestamp))).toDate(),
      tx_id: tx.hash,
      ... (msc && {
        market_name: msc.name,
        marketplace_smart_contract_id: msc.id,
      })
    }
  }
}