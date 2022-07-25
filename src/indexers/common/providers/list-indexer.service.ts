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
import { Commission } from "src/database/universal/entities/Commission";

@Injectable()
export class ListIndexerService implements IndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private listBotService: ListBotService,
    // private missingCollectionService: MissingCollectionService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(NftState)
    private nftStateRepository: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction) {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let market_sc: SmartContract;

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const price = this.txHelper.extractArgumentData(tx.args, scf, "price");
    const collection_map_id = this.txHelper.extractArgumentData(tx.args, scf, "collection_map_id");
    const commission_key = this.txHelper.extractArgumentData(tx.args, scf, 'commission_trait');
    let commission_id;
    if (commission_key) {
      const commission = await this.commissionRepository.findOneBy({ commission_key });
      if (commission) commission_id = commission.id;
    }

    let contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");

    // Check if custodial
    if (sc.type.includes(SmartContractType.non_fungible_tokens)) {
      if (contract_key) {
        market_sc = await this.smartContractRepository.findOneBy({ contract_key });
      }
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
      let update: any = {
        listed: true,
        list_price: price,
        list_contract_id: sc.id,
        list_tx_index: tx.nonce,
        list_seller: tx.signer,
        list_block_height: tx.block_height,
        ... (collection_map_id && { args: { collection_map_id }}),
        ... (commission_id && { commission_id })
      };

      // TODO: Use unified service to update NftMeta and handle NftState changes
      await this.nftStateRepository.upsert({ meta_id: nftMeta.id, ...update }, ["meta_id"]);

      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, sc, nftMeta, market_sc);
      const listActionParams: CreateListActionTO = {
        ...actionCommonArgs,
        list_price: price,
        seller: tx.signer,
      };

      const newAction = await this.createAction(listActionParams);
      if (newAction && tx.notify) {
        this.listBotService.createAndSend(newAction.id);
      }

      txResult.processed = true;
    } else if (nftMeta) {
      this.logger.log(`Too Late`);

      const price = this.txHelper.extractArgumentData(tx.args, scf, "price");
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, sc, nftMeta, market_sc);
      const listActionParams: CreateListActionTO = {
        ...actionCommonArgs,
        list_price: price,
        seller: tx.signer,
        ... (commission_id && { commission_id })
      };
  
      await this.createAction(listActionParams);
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);

      // this.missingCollectionService.scrapeMissing({ contract_key, token_id });
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
