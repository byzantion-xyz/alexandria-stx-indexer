import { Logger, Injectable, NotAcceptableException } from "@nestjs/common";

import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../helpers/tx-helper.service";

import { SalesBotService } from "src/discord-bot/providers/sales-bot.service";
import { CreateActionCommonArgs, CreateBuyActionTO } from "../interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { Action, Action as ActionEntity } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName } from "../helpers/indexer-enums";

@Injectable()
export class BuyIndexerService implements IndexerService {
  private readonly logger = new Logger(BuyIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private salesBotService: SalesBotService,
    @InjectRepository(ActionEntity)
    private actionRepository: Repository<ActionEntity>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");
    const price = this.txHelper.extractArgumentData(tx.args, scf, "price");

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, sc);
      const buyActionParams: CreateBuyActionTO = { 
        ...actionCommonArgs,
        list_price: price || (nftMeta.nft_state?.listed ? nftMeta.nft_state.list_price : undefined),
        seller: nftMeta.nft_state && nftMeta.nft_state.listed ? nftMeta.nft_state.list_seller : undefined,
        buyer: tx.signer,
        commission_id: nftMeta.nft_state?.commission_id
      };

      if (this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
        await this.txHelper.unlistMeta(nftMeta.id, tx.index || tx.nonce, tx.block_height);
        const newAction = await this.createAction(buyActionParams);
        if (newAction && tx.notify) {
          this.salesBotService.createAndSend(newAction.id);
        }
      } else  {
        this.logger.log(`Too Late`);
        // Create missing action
        await this.createAction(buyActionParams);
      }
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateBuyActionTO): Promise<ActionEntity> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);
      this.logger.log(`New action ${params.action}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }
}
