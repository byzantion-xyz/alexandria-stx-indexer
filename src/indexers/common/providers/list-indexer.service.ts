import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmartContract, SmartContractFunction, ActionName, SmartContractType } from '@prisma/client';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxHelperService } from '../helpers/tx-helper.service';
import { ListBotService } from 'src/discord-bot/providers/list-bot.service';
import { MissingCollectionService } from 'src/scrapers/near-scraper/providers/missing-collection.service';
import { CreateActionCommonArgs, CreateListAction } from '../interfaces/create-action-common.dto';

import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';

@Injectable()
export class ListIndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private txHelper: TxHelperService,
    private listBotService: ListBotService,
    private missingSmartContractService: MissingCollectionService
  ) { }

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction, notify: boolean) {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let market_sc: SmartContract;

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, 'token_id');
    let contract_key = this.txHelper.extractArgumentData(tx.args, scf, 'contract_key');
    const list_action = this.txHelper.extractArgumentData(tx.args, scf, 'list_action');

    // Check if custodial
    if (sc.type === SmartContractType.non_fungible_tokens) {
      market_sc = await this.prismaService.smartContract.findUnique({ where: { contract_key}})
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state) && list_action === 'sale') {
      const price = this.txHelper.extractArgumentData(tx.args, scf, 'price');

      let update = { 
        listed: true,
        list_price: price,
        list_contract_id: sc.id,
        list_tx_index: tx.nonce,
        list_seller: tx.signer,
        list_block_height: tx.block_height
      };

      // TODO: Use unified service to update NftMeta and handle NftState changes
      await this.prismaService.nftMeta.update({
        where: { id: nftMeta.id },
        data: { nft_state: { upsert: { create: update, update: update }}}
      });
      
      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, sc, nftMeta, market_sc);
      const listActionParams: CreateListAction = {
        ...actionCommonArgs,
        action: ActionName.list,
        list_price: price,
        seller: tx.signer
      };

      const newAction = await this.createAction(listActionParams); 
      if (newAction && notify) {
        this.listBotService.createAndSend(newAction.id);
      }

      txResult.processed = true;
    } else if (nftMeta) {
      if (list_action === 'sale') {
        this.logger.log(`Too Late`);
        // TODO: Create possible missing action
      } else {
        this.logger.log(`Msg market_type is: ${list_action}. No action required`);        
      }
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found by`, { contract_key, token_id });
      this.missingSmartContractService.scrapeMissing({ contract_key, token_id });
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.hash}`);
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