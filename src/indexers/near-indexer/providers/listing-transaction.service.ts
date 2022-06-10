import { Logger, Injectable } from '@nestjs/common';
import { Transaction, Block } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmartContract, SmartContractFunction, ActionName } from '@prisma/client';
import { TxProcessResult } from 'src/common/interfaces/tx-process-result.interface';
import { TxHelperService, CreateListAction, CreateActionCommonArgs } from './tx-helper.service';
import { ListBotService } from 'src/discord-bot/providers/list-bot.service';

@Injectable()
export class ListingTransactionService {
  private readonly logger = new Logger(ListingTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private txHelper: TxHelperService,
    private listBotService: ListBotService
  ) { }

  async process(
    tx: Transaction,
    block: Block,
    sc: SmartContract,
    scf: SmartContractFunction,
    notify: boolean
  ) {
    this.logger.debug(`process() ${tx.transaction.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    // TODO: Arguments will come parsed once near-streamer is updated
    const args = this.txHelper.parseBase64Arguments(tx);

    const token_id = this.txHelper.extractArgumentData(args, scf, 'token_id');
    const price = this.txHelper.extractArgumentData(args, scf, 'price');
    const contract_key = this.txHelper.extractArgumentData(args, scf, 'contract_key');
    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);    

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state, block)) {
      let update = { 
        listed: true,
        list_price: price,
        list_contract_id: sc.id,
        list_tx_index: tx.transaction.nonce,
        list_seller: tx.transaction.signer_id,
        list_block_height: block.block_height
      };
    
      // TODO: Use unified service to update NftMeta and handle NftState changes
      await this.prismaService.nftMeta.update({
        where: { id: nftMeta.id },
        data: { nft_state: { upsert: { create: update, update: update }}}
      });
      
      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, block, sc, nftMeta);
      const listActionParams: CreateListAction = {
        ...actionCommonArgs,
        action: ActionName.list,
        list_price: price,
        seller: tx.transaction.signer_id
      };

      const newAction = await this.createAction(listActionParams); 
      if (newAction && notify) {
        this.listBotService.createAndSend(nftMeta.id, tx.transaction.hash);
      }

      txResult.processed = true;
    } else if (nftMeta) {
      this.logger.log(`Too Late`);
      // TODO: Create possible missing action
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found by`, { contract_key, token_id });
      // TODO: Call Missing Collection handle once built
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.transaction.hash}`);
    return txResult;
  }

  async createAction(params: CreateListAction) {
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