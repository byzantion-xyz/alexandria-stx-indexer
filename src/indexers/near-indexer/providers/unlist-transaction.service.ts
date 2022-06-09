import { Logger, Injectable, NotAcceptableException } from '@nestjs/common';
import { Transaction, Block } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { Prisma, NftMeta, SmartContract, SmartContractFunction, ActionName } from '@prisma/client';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { TxHelperService, CreateUnlistAction, CreateActionCommonArgs } from './tx-helper.service';

@Injectable()
export class UnlistTransactionService {
    private readonly logger = new Logger(UnlistTransactionService.name);

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

        const token_id =  this.txHelper.extractArgumentData(args, scf, 'token_id');
        const contract_key =  this.txHelper.extractArgumentData(args, scf, 'contract_key');
        const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

        // TODO: Use handle to check when meta is newly updated
        if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state, block)) {
            await this.txHelper.unlistMeta(nftMeta.id, tx.transaction.nonce, block.block_height);

            const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, block, sc, nftMeta);
            const listActionParams: CreateUnlistAction = {
                ...actionCommonArgs,
                action: ActionName.unlist,
                list_price: nftMeta.nft_state.list_price,
                seller: nftMeta.nft_state.list_seller
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
