import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { attribute_names, TxUpgradeHelperService } from 'src/indexers/stacks-indexer/helpers/tx-upgrade-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateListActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class UpgradeIndexerService implements IndexerService {
  private readonly logger = new Logger(UpgradeIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txUpgradeHelper: TxUpgradeHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    try {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const ref_contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'ref_contract_key');
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id');
    const name = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'name');
    const { contract_key } = sc;

    const token_id_list: string[] = attribute_names.map(attr_name => {
      return this.stacksTxHelper.extractArgumentData(tx.args, scf, attr_name).toString();
    });

    const nftMeta = await this.txUpgradeHelper.findMetaByContractKeyWithAttr(contract_key, token_id);
    
    if (nftMeta) {
      const newBot = await this.txUpgradeHelper.findMetasByContractKeyWithAttr(ref_contract_key, token_id_list);      
      await this.txUpgradeHelper.upgradeMegapont(nftMeta, newBot, token_id_list, name);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  } catch (err) {
    this.logger.error(err);
    throw err;
  }
  }

  async createAction(params: CreateListActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);
      this.logger.log(`New action ${params.action}: ${saved.id} `);
      return saved;
    } catch (err) {}
  }
}
