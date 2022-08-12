import { Logger, Injectable } from "@nestjs/common";

import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";

import { SalesBotService } from "src/discord-bot/providers/sales-bot.service";
import { CreateBuyActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { Action as ActionEntity } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName } from "src/indexers/common/helpers/indexer-enums";
import { StacksTxHelperService } from "./stacks-tx-helper.service";

@Injectable()
export class BuyIndexerService implements IndexerService {
  private readonly logger = new Logger(BuyIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private salesBotService: SalesBotService,
    @InjectRepository(ActionEntity)
    private actionRepository: Repository<ActionEntity>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, sc);
      const buyActionParams: CreateBuyActionTO = { 
        ...actionCommonArgs,
        list_price: nftMeta.nft_state?.listed ? nftMeta.nft_state.list_price : undefined,
        seller: nftMeta.nft_state && nftMeta.nft_state.listed ? nftMeta.nft_state.list_seller : undefined,
        buyer: tx.signer,
        market_name: nftMeta.nft_state?.commission?.market_name || null,
        commission_id: nftMeta.nft_state?.commission?.id
      };

      if (this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
        await this.txHelper.unlistMeta(nftMeta.id, tx);
        const newAction = await this.createAction(buyActionParams);
        if (newAction && tx.notify) {
          //this.salesBotService.createAndSend(newAction.id);
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
