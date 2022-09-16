import { Logger, Injectable, NotAcceptableException } from "@nestjs/common";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { CreateUnlistActionTO } from "src/indexers/common/interfaces/create-action-common.dto";

import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";

import { InjectRepository } from "@nestjs/typeorm";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "src/indexers/common/helpers/indexer-enums";
import { Action } from "src/database/universal/entities/Action";
import { StacksTxHelperService } from "./stacks-tx-helper.service";

@Injectable()
export class UnlistIndexerService implements IndexerService {
  private readonly logger = new Logger(UnlistIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, sc);
      const nft_list_state = this.txHelper.findStateList(nftMeta.nft_state, sc.id);

      const unlistActionParams: CreateUnlistActionTO = {
        ...actionCommonArgs,
        list_price: nft_list_state?.list_price,
        seller: nft_list_state?.list_seller,
        market_name: nft_list_state?.commission?.market_name || null,
        commission_id: nft_list_state?.commission?.id,
      };

      if (this.stacksTxHelper.isNewerEvent(tx, nft_list_state)) {
        await this.txHelper.unlistMeta(nftMeta, tx, sc);
      } else {
        this.logger.log(`Too Late`);
      }
      await this.createAction(unlistActionParams);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

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
