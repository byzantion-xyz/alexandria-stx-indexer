import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { NftState } from 'src/database/universal/entities/NftState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, SmartContractType } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { TxStakingHelperService } from 'src/indexers/common/helpers/tx-staking-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateStakeActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { NearTxHelperService } from './near-tx-helper.service';

const NFT_TRANSFER_EVENT = 'nft_on_transfer';
const RESOLVE_TRANSFER = 'nft_resolve_transfer';

@Injectable()
export class StakeIndexerService implements IndexerService {
  private readonly logger = new Logger(StakeIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
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

    const transfer = this.nearTxHelper.findEventData(tx.receipts, NFT_TRANSFER_EVENT);
    const receipt = this.nearTxHelper.findReceiptWithEvent(tx.receipts, RESOLVE_TRANSFER);

    if (!transfer || !receipt) {
      this.logger.debug(`No ${NFT_TRANSFER_EVENT} event found for tx hash: ${tx.hash}`);
      return txResult;
    }

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const contract_key = sc.contract_key;
    const stake_account = receipt.receiver_id;
   
    const stake_sc = await this.smartContractRepository.findOne({ where: { contract_key: stake_account }});
    
    if (!stake_sc || !stake_sc.type.includes(SmartContractType.staking)) {
      this.logger.warn(`Stake contract: ${stake_account} not found`);
      txResult.missing = true;
      return txResult;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName[scf.name], tx, nftMeta, stake_sc);
      const stakeActionParams: CreateStakeActionTO = {
        ...actionCommonArgs,
        seller: tx.signer,
      };

      if (this.txStakingHelper.isNewStakingBlock(tx, nftMeta.nft_state)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx);

        await this.txHelper.stakeMeta(nftMeta.id, tx, sc, stake_sc);
        await this.createAction(stakeActionParams);       
      } else {
        this.logger.log(`Too Late`);
        await this.createAction(stakeActionParams);
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
