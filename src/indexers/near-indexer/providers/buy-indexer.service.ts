import { Logger, Injectable, NotAcceptableException } from "@nestjs/common";

import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../../common/helpers/tx-helper.service";

import { SalesBotService } from "src/discord-bot/providers/sales-bot.service";
import { CreateActionCommonArgs, CreateBuyActionTO } from "../../common/interfaces/create-action-common.dto";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../../common/interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { Action, Action as ActionEntity } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "../../common/helpers/indexer-enums";
import { NearTxHelperService } from "src/indexers/near-indexer/providers/near-tx-helper.service";
import { parseAssetInfoString } from "@stacks/transactions";

@Injectable()
export class BuyIndexerService implements IndexerService {
  private readonly logger = new Logger(BuyIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private salesBotService: SalesBotService,
    @InjectRepository(ActionEntity)
    private actionRepository: Repository<ActionEntity>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let msc = Object.assign({}, sc);

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");
    const price = this.txHelper.extractArgumentData(tx.args, scf, "price");
    const seller = this.txHelper.extractArgumentData(tx.args, scf, "seller");

    // Check if has custodial smart contract
    if (sc.type.includes(SmartContractType.non_fungible_tokens) && sc.custodial_smart_contract) {
      msc = sc.custodial_smart_contract;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, msc);
      const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, msc.id);

      const buyActionParams: CreateBuyActionTO = { 
        ...actionCommonArgs,
        list_price: price || (nft_state_list?.listed ? nft_state_list.list_price : null),
        seller: nft_state_list?.listed ? nft_state_list?.list_seller : (seller || null),
        buyer: tx.signer
      };

      if (this.nearTxHelper.isNewerEvent(tx, nft_state_list)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, msc);
        const newAction = await this.createAction(buyActionParams);
        if (newAction && tx.notify) {
          this.salesBotService.createAndSend(newAction.id);
        }
      } else {
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
