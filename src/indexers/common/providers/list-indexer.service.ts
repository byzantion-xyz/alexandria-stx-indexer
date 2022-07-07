import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../helpers/tx-helper.service";
import { ListBotService } from "src/discord-bot/providers/list-bot.service";
import { MissingCollectionService } from "src/scrapers/near-scraper/providers/missing-collection.service";
import {
  CreateActionCommonArgs,
  CreateListActionTO,
} from "../interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "../helpers/indexer-enums";
import { NftState } from "src/database/universal/entities/NftState";

@Injectable()
export class ListIndexerService implements IndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private listBotService: ListBotService,
    // private missingSmartContractService: MissingCollectionService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(NftState)
    private nftStateRepository: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction) {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let market_sc: SmartContract;

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    let contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");
    const list_action = this.txHelper.extractArgumentData(tx.args, scf, "list_action");

    // Check if custodial
    if (sc.type === SmartContractType.non_fungible_tokens) {
      market_sc = await this.smartContractRepository.findOneBy({ contract_key });
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state) && list_action === "sale") {
      const price = this.txHelper.extractArgumentData(tx.args, scf, "price");

      let update = {
        listed: true,
        list_price: price,
        list_contract_id: sc.id,
        list_tx_index: tx.nonce,
        list_seller: tx.signer,
        list_block_height: tx.block_height,
      };

      // TODO: Use unified service to update NftMeta and handle NftState changes
      await this.nftStateRepository.upsert({ meta_id: nftMeta.id, ...update }, ["meta_id"]);

      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, sc, nftMeta, market_sc);
      const listActionParams: CreateListActionTO = {
        ...actionCommonArgs,
        action: ActionName.list,
        list_price: price,
        seller: tx.signer,
      };

      const newAction = await this.createAction(listActionParams);
      if (newAction && tx.notify) {
        this.listBotService.createAndSend(newAction.id);
      }

      txResult.processed = true;
    } else if (nftMeta) {
      if (list_action === "sale") {
        this.logger.log(`Too Late`);

        const price = this.txHelper.extractArgumentData(tx.args, scf, "price");
        const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, sc, nftMeta, market_sc);
        const listActionParams: CreateListActionTO = {
          ...actionCommonArgs,
          action: ActionName.list,
          list_price: price,
          seller: tx.signer,
        };
  
        await this.createAction(listActionParams);
      } else {
        this.logger.log(`Msg market_type is: ${list_action}. No action required`);
      }
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);

      // this.missingSmartContractService.scrapeMissing({ contract_key, token_id });
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.hash}`);
    return txResult;
  }

  async createAction(params: CreateListActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);
      this.logger.log(`New action ${params.action}: ${saved.id} `);
      return saved;
    } catch (err) {}
  }
}
