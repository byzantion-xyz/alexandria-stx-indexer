import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { NftState } from 'src/database/universal/entities/NftState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';

@Injectable()
export class BnsRegisterIndexerService implements IndexerService {
  private readonly logger = new Logger(BnsRegisterIndexerService.name);
  
  constructor(
    private txHelper: TxHelperService,
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
