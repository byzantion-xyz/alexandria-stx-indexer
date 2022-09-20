import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, SmartContractType } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateMintActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { Repository } from 'typeorm';

@Injectable()
export class NftMintEventIndexerService implements IndexerService {
  private readonly logger = new Logger(NftMintEventIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private txActionService: TxActionService,
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };
    let msc: SmartContract;

    const receipt = tx.receipts[0];  

    const token_ids: [string] = this.txHelper.extractArgumentData(tx.args, scf, "token_ids");
    if (!token_ids || !token_ids.length) {
      this.logger.warn(`Unable to find token_ids tx hash: ${tx.hash}`);
      return txResult;
    }
    const token_id = token_ids[0];
    const buyer = this.txHelper.extractArgumentData(tx.args, scf, "owner");
    const contract_key = receipt.receiver_id;

    // Check if has custodial smart contract
    if (sc.type.includes(SmartContractType.non_fungible_tokens) && sc.custodial_smart_contract) {
      msc = sc.custodial_smart_contract;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.mint, tx, nftMeta, msc);
      const mintActionParams: CreateMintActionTO = { 
        ...actionCommonArgs,
        buyer 
      };
      
      if (!nftMeta.nft_state || !nftMeta.nft_state.minted) {
        await this.txHelper.mintMeta(nftMeta, tx, buyer);
      }

      await this.createAction(mintActionParams);
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateMintActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
