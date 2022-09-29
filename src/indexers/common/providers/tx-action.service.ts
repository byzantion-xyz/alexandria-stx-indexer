import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { Repository } from 'typeorm';
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

}
