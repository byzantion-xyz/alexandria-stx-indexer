import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { TxStakingHelperService } from 'src/indexers/common/helpers/tx-staking-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateUnstakeActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Action } from 'src/database/universal/entities/Action';
import { NftState } from 'src/database/universal/entities/NftState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { ActionName, SmartContractType } from 'src/indexers/common/helpers/indexer-enums';

@Injectable()
export class UnstakeIndexerService implements IndexerService {
  private readonly logger = new Logger(UnstakeIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private txStakingHelper: TxStakingHelperService,
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

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");
 
    if (!sc.type.includes(SmartContractType.staking)) {
      this.logger.log(`Stake contract: ${contract_key} does not have staking type`);
      txResult.missing = true;
      return txResult;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);   
    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta.smart_contract, nftMeta, sc);
      const unstakeActionParams: CreateUnstakeActionTO = {
        ...actionCommonArgs,
        seller: tx.signer,
      };

      if (this.txStakingHelper.isNewStakingBlock(tx, nftMeta.nft_state)) {
        await this.txHelper.unstakeMeta(nftMeta.id, tx);

        await this.createAction(unstakeActionParams);
      } else {
        this.logger.log(`Too Late`);
        await this.createAction(unstakeActionParams);
      }
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);
      this.logger.log(`New action ${params.action}: ${saved.id} `);
      return saved;
    } catch (err) {}
  }
}