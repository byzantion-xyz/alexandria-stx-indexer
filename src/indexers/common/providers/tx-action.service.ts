import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { InsertResult, Repository } from 'typeorm';
import { ActionName } from '../helpers/indexer-enums';
import { CreateActionTO } from '../interfaces/create-action-common.dto';

@Injectable()
export class TxActionService {
  private readonly logger = new Logger(TxActionService.name);

  constructor(
    @InjectRepository(Action)
    private actionRepo: Repository<Action>
  ) {}

  async saveAction(params: CreateActionTO): Promise<Action> {
    try {
      const action = this.actionRepo.create(params);
      const saved = await this.actionRepo.save(action);
      this.logger.log(`New action ${params.action}: ${saved.id} `);

      return saved;
    } catch (err) { 
      if (err && (!err.constraint || err.constraint !== 'action_tx_id_tx_index_idx')) {
        this.logger.warn(err);
      }
    }
  }

  async upsertAction(params: CreateActionTO): Promise<any> {
    try {      
      const upserted: InsertResult = await this.actionRepo.upsert(params, ['tx_id', 'tx_index']);
      this.logger.log(`Upserted action ${params.action}: ${upserted.identifiers[0].id} `);

      return upserted.raw;
    } catch (err) {
      this.logger.warn(err);
    }
  }

}
