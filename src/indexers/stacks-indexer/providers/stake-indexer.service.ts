import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CommonUtilService } from "src/common/helpers/common-util/common-util.service";
import { Action } from "src/database/universal/entities/Action";
import { NftState } from "src/database/universal/entities/NftState";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { ActionName, SmartContractType } from "src/indexers/common/helpers/indexer-enums";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { TxStakingHelper } from "src/indexers/common/helpers/tx-staking-helper";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { CreateStakeActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";
import { Repository } from "typeorm";
import { StacksTxHelperService } from "./stacks-tx-helper.service";

@Injectable()
export class StakeIndexerService implements IndexerService {
  private readonly logger = new Logger(StakeIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txStakingHelper: TxStakingHelper,
    private txActionService: TxActionService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    let stake_contract;
    let contract_key;

    // Check when staking is executed on staking sc or in nft contract.
    if (sc.type.includes(SmartContractType.staking)) {
      stake_contract = sc.contract_key;
      contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, "contract_key");
      if (!contract_key) {
        contract_key = this.stacksTxHelper.extractNftContractFromEvents(tx.events);
      }
    }

    const stake_sc = await this.smartContractRepository.findOne({ where: { contract_key: stake_contract } });

    if (!stake_sc || !stake_sc.type.includes(SmartContractType.staking)) {
      this.logger.log(`Stake contract: ${stake_contract} not found`);
      txResult.missing = true;
      return txResult;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, stake_sc);
      const stakeActionParams: CreateStakeActionTO = {
        ...actionCommonArgs,
        seller: tx.signer,
        market_name: null,
      };

      if (this.txStakingHelper.isNewStakingBlock(tx, nftMeta.nft_state)) {
        this.txHelper.stakeMeta(nftMeta.id, tx, sc, stake_sc);

        await this.createAction(stakeActionParams);
      } else {
        this.logger.debug(`Too Late`);
        await this.createAction(stakeActionParams);
      }
      txResult.processed = true;
    } else {
      this.logger.debug(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateStakeActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
