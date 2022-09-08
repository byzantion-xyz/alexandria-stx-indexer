import { Logger, Injectable } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { NftStateArguments, TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { MissingCollectionService } from "src/scrapers/near-scraper/providers/missing-collection.service";
import { CreateListActionTO } from "src/indexers/common/interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "src/indexers/common/helpers/indexer-enums";
import { NftState } from "src/database/universal/entities/NftState";
import { StacksTxHelperService } from "./stacks-tx-helper.service";

@Injectable()
export class ListIndexerService implements IndexerService {
  private readonly logger = new Logger(ListIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private missingCollectionService: MissingCollectionService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(NftState)
    private nftStateRepository: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const price = this.stacksTxHelper.extractArgumentData(tx.args, scf, "list_price");
    const collection_map_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "collection_map_id");
    let commission_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'commission_trait');
    let contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const commission = await this.txHelper.findCommissionByKey(sc, contract_key, commission_key);
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, sc);
      const listActionParams: CreateListActionTO = {
        ...actionCommonArgs,
        list_price: price,
        seller: tx.signer,
        ... (commission && { commission_id: commission.id }),
        market_name: commission?.market_name || null
      };

      const nft_state_list = this.txHelper.findStateList(nftMeta.nft_state, sc.id);

      if (this.stacksTxHelper.isNewerEvent(tx, nft_state_list)) {
        const args: NftStateArguments = {
          ... (collection_map_id && { collection_map_id })
        };
        await this.txHelper.listMeta(nftMeta, tx, sc, price, commission?.id, args);

        await this.createAction(listActionParams);
      } else {
        this.logger.log(`Too Late`);
        await this.createAction(listActionParams);
      }
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);

      //this.missingCollectionService.scrapeMissing({ contract_key, token_id });
      txResult.missing = true;
    }

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
