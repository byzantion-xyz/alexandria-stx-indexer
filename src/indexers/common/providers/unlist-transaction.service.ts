import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmartContract, SmartContractFunction, ActionName, SmartContractType } from '@prisma/client';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxHelperService } from '../../near-indexer/providers/tx-helper.service';
import { CreateActionCommonArgs, CreateUnlistAction } from '../interfaces/create-action-common.dto';

import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';

@Injectable()
export class UnlistTransactionService {
  private readonly logger = new Logger(UnlistTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private txHelper: TxHelperService
  ) { }

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction, notify: boolean) {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let market_sc: SmartContract;

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, 'token_id');
    let contract_key = this.txHelper.extractArgumentData(tx.args, scf, 'contract_key');
    
    // Check if custodial
    if (sc.type === SmartContractType.non_fungible_tokens) {
      market_sc = await this.prismaService.smartContract.findUnique({ where: { contract_key } })
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
      await this.txHelper.unlistMeta(nftMeta.id, tx.nonce, tx.block_height);

      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, sc, nftMeta, market_sc);
      const unlistActionParams: CreateUnlistAction = {
        ...actionCommonArgs,
        action: ActionName.unlist,
        list_price: nftMeta.nft_state && nftMeta.nft_state.list_price ? nftMeta.nft_state.list_price : undefined,
        seller: nftMeta.nft_state?.list_seller || undefined
      };

      await this.createAction(unlistActionParams);

      txResult.processed = true;
    } else if (nftMeta) {
      this.logger.log(`Too Late`);
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found by`, { contract_key, token_id });
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.hash}`);
    return txResult;
  }

  async createAction(params: CreateUnlistAction) {
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
