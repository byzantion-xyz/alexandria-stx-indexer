import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { NftState } from 'src/database/universal/entities/NftState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, SmartContractType } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateMintActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { runInThisContext } from 'vm';
import { NearTxHelperService } from './near-tx-helper.service';

@Injectable()
export class NftMintEventIndexerService implements IndexerService {
  private readonly logger = new Logger(NftMintEventIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
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
    let msc: SmartContract;

    const receipt = tx.receipts[0];  

    const token_ids: [string] = this.txHelper.extractArgumentData(tx.args, scf, "token_ids");
    const token_id = token_ids[0];
    const buyer = this.txHelper.extractArgumentData(tx.args, scf, "owner");
    const contract_key = receipt.receiver_id;

    // Check if has custodial smart contract
    if (sc.type.includes(SmartContractType.non_fungible_tokens) && sc.custodial_smart_contract) {
      msc = sc.custodial_smart_contract;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id[0]);

    if (nftMeta) {
      await this.txHelper.mintMeta(nftMeta, tx, buyer);
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.mint, tx, nftMeta, msc);
      const mintActionParams: CreateMintActionTO = { 
        ...actionCommonArgs,
        buyer 
      };

      await this.createAction(mintActionParams);
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateActionTO): Promise<Action> {
    throw new Error('Method not implemented.');
  }

}
