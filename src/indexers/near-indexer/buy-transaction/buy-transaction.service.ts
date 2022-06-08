import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { Transaction, Block } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { Prisma, NftMeta, SmartContract, SmartContractFunction, ActionName } from '@prisma/client';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import {
  TxHelperService,
  CreateBuyAction,
  CreateActionCommonArgs
} from '../helpers/tx-helper/tx-helper.service';

import moment from 'moment';

@Injectable()
export class BuyTransactionService {
  private readonly logger = new Logger(BuyTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private txHelper: TxHelperService
  ) { }

  async process(
    tx: Transaction,
    block: Block,
    sc: SmartContract,
    scf: SmartContractFunction
  ) {
    this.logger.debug(`process() ${tx.transaction.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    // TODO: Arguments will be parsed in the streamer directly.
    let args = this.txHelper.parseBase64Arguments(tx);

    const token_id = args[scf.args['token_id']];
    const contract_key = args[scf.args['contract_key']];

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state, block)) {
      await this.txHelper.unlistMeta(nftMeta.id, tx.transaction.nonce, block.block_height);

      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, block, sc, nftMeta);
      const buyActionParams: CreateBuyAction = {
        ...actionCommonArgs,
        action: ActionName.buy,
        list_price: nftMeta.nft_state.list_price,
        seller: nftMeta.nft_state.list_seller,
        buyer: tx.transaction.signer_id,
      };

      await this.createAction(buyActionParams);

      txResult.processed = true;
    } else if (nftMeta) {
      this.logger.log(`Too Late`);
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found by`, { contract_key, token_id });
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.transaction.hash}`);
    return txResult;
  }

  async createAction(params: CreateBuyAction) {
    try {
      const action = await this.prismaService.action.create({
        data: { ...params }
      });

      this.logger.log(`New action ${params.action}: ${action.id} `);
    } catch (err) {
      this.logger.warn(err);
    }
  }

}
