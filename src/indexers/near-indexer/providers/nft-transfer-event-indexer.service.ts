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
import { NearTxHelperService } from "./near-tx-helper.service";

const NFT_TRANSFER_EVENT = 'nft_transfer';

@Injectable()
export class NftTransferEventIndexerService implements IndexerService {
  private readonly logger = new Logger(NftTransferEventIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txStakingHelper: TxStakingHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    
    const receipt = tx.receipts[0];
    const token_ids: [string] = this.txHelper.extractArgumentData(tx.args, scf, 'token_ids');
    if (!token_ids || !token_ids.length) {
      this.logger.warn(`Unable to find token_ids tx hash: ${tx.hash}`);
      return txResult;
    }
    const token_id = token_ids[0];
    
    const seller = this.txHelper.extractArgumentData(tx.args, scf, 'seller');
    const buyer = this.txHelper.extractArgumentData(tx.args, scf, 'buyer');
    const contract_key = receipt.receiver_id;

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.transfer, tx, nftMeta);
      const transferActionParams: CreateTransferActionTO = { 
        ...actionCommonArgs, 
        buyer,
        seller
      };

      // Unlist listed meta when it was listed on previous block
      if (this.txHelper.isListedPreviously(nftMeta.nft_state, tx)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx);
      }

      // Unstake staked meta when is transferred from staking contract
      if (nftMeta.nft_state && nftMeta.nft_state.staked && 
        this.txStakingHelper.isNewStakingBlock(tx, nftMeta.nft_state) &&
        sc.type.includes(SmartContractType.staking)
      ) {
        await this.txHelper.unstakeMeta(nftMeta.id, tx);
      }

      if (this.txHelper.isNewOwnerEvent(tx, nftMeta.nft_state)) {
        await this.txHelper.setNewMetaOwner(nftMeta, tx, buyer);
      }

      // TODO: Cancel any active older bids when bids are implemented on NEAR

      await this.createAction(transferActionParams);
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
    } catch (err) { this.logger.warn(err); }
  }
}
