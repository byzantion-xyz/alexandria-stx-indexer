import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { Transaction, Block } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, NftMeta, SmartContract, SmartContractFunction, ActionName, SmartContractType } from '@prisma/client';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { TxHelperService } from './tx-helper.service';
import { CreateActionCommonArgs, CreateUnlistAction } from '../dto/create-action-common.dto';

@Injectable()
export class UnlistTransactionService {
  private readonly logger = new Logger(UnlistTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private txHelper: TxHelperService
  ) { }

  async process(tx: Transaction, sc: SmartContract, scf: SmartContractFunction, notify: boolean) {
    this.logger.debug(`process() ${tx.transaction.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let market_sc: SmartContract;

    // TODO: Arguments will be parsed in the streamer directly.
    let args = this.txHelper.parseBase64Arguments(tx);

    const token_id = this.txHelper.extractArgumentData(args, scf, 'token_id');
    let contract_key = this.txHelper.extractArgumentData(args, scf, 'contract_key');
    
    // Check if custodial
    if (sc.type === SmartContractType.non_fungible_tokens) {
      market_sc = await this.prismaService.smartContract.findUnique({ where: { contract_key } })
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
      await this.txHelper.unlistMeta(nftMeta.id, tx.transaction.nonce, tx.block.block_height);

      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, sc, nftMeta, market_sc);
      const listActionParams: CreateUnlistAction = {
        ...actionCommonArgs,
        action: ActionName.unlist,
        list_price: nftMeta.nft_state?.list_price || undefined,
        seller: nftMeta.nft_state?.list_seller || undefined
      };

      await this.createAction(listActionParams);

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
