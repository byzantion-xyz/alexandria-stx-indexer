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
import { MegapontAttribute } from 'src/database/universal/entities/MegapontAttribute';
import { NftMetaAttribute } from 'src/database/universal/entities/NftMetaAttribute';
import { NftMeta } from 'src/database/universal/entities/NftMeta';

@Injectable()
export class UpgradeMegaIndexerService implements IndexerService {
  private readonly logger = new Logger(UpgradeMegaIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private txUpgradeHelper: TxUpgradeHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    @InjectRepository(NftMetaAttribute)
    private nftMetaAttributeRepository: Repository<NftMetaAttribute>,
    @InjectRepository(MegapontAttribute)
    private megapontAttributeRepository: Repository<MegapontAttribute>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    try {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const robot_asset_name = this.txHelper.extractArgumentData(tx.args, scf, 'robot_asset_name');
    const component_asset_name = this.txHelper.extractArgumentData(tx.args, scf, 'component_asset_name');
    const token_id = this.txHelper.extractArgumentData(tx.args, scf, 'token_id');
    const name = this.txHelper.extractArgumentData(tx.args, scf, 'name');
    const { contract_key } = sc;
    
    const token_id_list: string[] = attribute_names.map(attr_name => {
      return this.txHelper.extractArgumentData(tx.args, scf, attr_name).toString();
    });

    const nftMeta = await this.txUpgradeHelper.findMetaByAssetNameWithAttr(robot_asset_name, token_id);

    if (nftMeta) {
      const newBot = await this.txUpgradeHelper.findMetasByAssetNameWithAttr(
        component_asset_name, token_id_list
      );
      await this.txUpgradeHelper.upgradeMegapont(nftMeta, newBot, token_id_list, name);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }
  catch (err) {
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
