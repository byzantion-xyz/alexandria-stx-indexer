import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, SmartContractType } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { TxStakingHelper } from 'src/indexers/common/helpers/tx-staking-helper';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateStakeActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { Repository } from 'typeorm';
import { NearTxHelperService } from './near-tx-helper.service';

const NFT_TRANSFER_EVENT = 'nft_on_transfer';

@Injectable()
export class StakeIndexerService implements IndexerService {
  private readonly logger = new Logger(StakeIndexerService.name);
  readonly stakingScs: SmartContract[];

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txStakingHelper: TxStakingHelper,
    private txActionService: TxActionService,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const receipt = this.nearTxHelper.findReceiptWithFunctionCall(tx.receipts, NFT_TRANSFER_EVENT);
    if (!receipt) {
      this.logger.log(`No ${NFT_TRANSFER_EVENT} event found for tx hash: ${tx.hash}`);
      return txResult;
    }

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = sc.contract_key;
    const stake_account = receipt.receiver_id;
   
    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const stake_sc = Array.isArray(this.stakingScs) 
      ? this.stakingScs.find(sc => sc.contract_key === stake_account)
      : await this.smartContractRepository.findOne({ where: { contract_key: stake_account }});
    
    if (!stake_sc || !stake_sc.type.includes(SmartContractType.staking)) {
      this.logger.warn(`Stake contract: ${stake_account} not found`);
      txResult.missing = true;
      return txResult;
    }

    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, stake_sc);
    const stakeActionParams: CreateStakeActionTO = {
      ...actionCommonArgs,
      seller: tx.signer,
    };

    if (this.txStakingHelper.isNewStakingBlock(tx, nftMeta.nft_state)) {
      if (this.txHelper.isListedPreviously(nftMeta.nft_state, tx)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx);
      }
      await this.txHelper.stakeMeta(nftMeta.id, tx, sc, stake_sc);
    } else {
      this.logger.debug(`Too Late`);
    }
    await this.createAction(stakeActionParams);

    txResult.processed = true;

    return txResult;
  }
  
  async createAction(params: CreateActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
