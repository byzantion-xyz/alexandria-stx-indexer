import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, NftMeta, SmartContract, SmartContractFunction, ActionName, Action } from '@prisma/client';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { TxHelperService } from './tx-helper.service';

import { SalesBotService } from 'src/discord-bot/providers/sales-bot.service';
import { CreateActionCommonArgs, CreateBuyAction } from '../dto/create-action-common.dto';
import { Transaction } from '../dto/near-transaction.dto';

@Injectable()
export class BuyTransactionService {
  private readonly logger = new Logger(BuyTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private txHelper: TxHelperService,
    private salesBotService: SalesBotService
  ) { }

  async process(tx: Transaction, sc: SmartContract, scf: SmartContractFunction, notify: boolean) {
    this.logger.debug(`process() ${tx.transaction.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    // TODO: Arguments will be parsed in the streamer directly.
    let args = this.txHelper.parseBase64Arguments(tx);

    const token_id = this.txHelper.extractArgumentData(args, scf, 'token_id');
    const contract_key = this.txHelper.extractArgumentData(args, scf, 'contract_key');
    const price = this.txHelper.extractArgumentData(args, scf, 'price');

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {

      await this.txHelper.unlistMeta(nftMeta.id, tx.transaction.nonce, tx.block_height);

      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, sc, nftMeta, sc);
      const buyActionParams: CreateBuyAction = {
        ...actionCommonArgs,
        action: ActionName.buy,
        list_price: price || (nftMeta.nft_state?.listed ? nftMeta.nft_state.list_price : undefined),
        seller: nftMeta.nft_state && nftMeta.nft_state.listed ? nftMeta.nft_state.list_seller : undefined,
        buyer: tx.transaction.signer_id,
      };

      const newAction = await this.createAction(buyActionParams);
      if (newAction && notify) {
        this.salesBotService.createAndSend(newAction.id);
      }

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
      return action;
    } catch (err) {
      this.logger.warn(err);
    }
  }

}
