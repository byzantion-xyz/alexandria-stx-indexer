import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class RenameIndexerService implements IndexerService {
  private readonly logger = new Logger(RenameIndexerService.name);

  constructor (
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'contract_key');
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id');
    const name = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'name');

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);
    if (nftMeta) {
      nftMeta.name = `#${nftMeta.token_id} - ${name}`;
      await this.nftMetaRepository.save(nftMeta);
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateActionTO): Promise<Action> {
    return;
  }

}

