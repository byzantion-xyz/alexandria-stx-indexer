import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { CreateTransferActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";

import { Repository } from "typeorm";
import { ActionName, SmartContractType } from "src/indexers/common/helpers/indexer-enums";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { TxStakingHelperService } from "src/indexers/common/helpers/tx-staking-helper.service";

@Injectable()
export class TransferIndexerService implements IndexerService {
  private readonly logger = new Logger(TransferIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private txStakingHelper: TxStakingHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const { contract_key } = sc;
    const token_id = this.txHelper.extractArgumentData(tx.args, scf, 'token_id');
    const buyer = this.txHelper.extractArgumentData(tx.args, scf, 'buyer');

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      //const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.transfer, tx, nftMeta);
      //const listActionParams: CreateTransferActionTO = { 
      //  ...actionCommonArgs, 
      //  buyer,
      //  seller: tx.signer,
      //};

      if (this.txHelper.isListedInAnyMarketplace(nftMeta.nft_state)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx);
      }

      // Unstake staked meta when is transferred from staking contract
      if (nftMeta.nft_state && nftMeta.nft_state.staked && 
        this.txStakingHelper.isNewStakingBlock(tx, nftMeta.nft_state)) {
        await this.txHelper.unstakeMeta(nftMeta.id, tx);
      }

      //await this.createAction(listActionParams);
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateTransferActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);
      this.logger.log(`New action ${params.action}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }
}
