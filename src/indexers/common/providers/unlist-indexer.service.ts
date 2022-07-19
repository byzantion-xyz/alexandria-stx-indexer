import { Logger, Injectable, NotAcceptableException } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "../helpers/tx-helper.service";
import {
  CreateActionCommonArgs,
  CreateUnlistActionTO,
} from "../interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "../interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "../helpers/indexer-enums";
import { Action } from "src/database/universal/entities/Action";

@Injectable()
export class UnlistIndexerService implements IndexerService {
  private readonly logger = new Logger(UnlistIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let market_sc: SmartContract;

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    let contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");

    // Check if custodial
    if (sc.type.includes(SmartContractType.non_fungible_tokens)) {
      market_sc = await this.smartContractRepository.findOneBy({ contract_key });
      contract_key = sc.contract_key;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta && this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
      await this.txHelper.unlistMeta(nftMeta.id, tx.nonce, tx.block_height);

      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, sc, nftMeta, market_sc);
      const unlistActionParams: CreateUnlistActionTO = {
        ...actionCommonArgs,
        action: ActionName.unlist,
        list_price: nftMeta.nft_state && nftMeta.nft_state.list_price ? nftMeta.nft_state.list_price : undefined,
        seller: nftMeta.nft_state?.list_seller || undefined,
      };

      await this.createAction(unlistActionParams);

      txResult.processed = true;
    } else if (nftMeta) {
      this.logger.log(`Too Late`);
      // Create missing action
      const actionCommonArgs: CreateActionCommonArgs = this.txHelper.setCommonActionParams(tx, sc, nftMeta, market_sc);
      const unlistActionParams: CreateUnlistActionTO = {
        ...actionCommonArgs,
        action: ActionName.unlist,
        list_price: nftMeta.nft_state && nftMeta.nft_state.list_price ? nftMeta.nft_state.list_price : undefined,
        seller: nftMeta.nft_state?.list_seller || undefined,
      };

      await this.createAction(unlistActionParams);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    this.logger.debug(`process() completed ${tx.hash}`);
    return txResult;
  }

  async createAction(params: CreateUnlistActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);

      this.logger.log(`New action ${params.action}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }
}
