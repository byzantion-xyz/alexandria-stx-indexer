import { Injectable, Logger } from '@nestjs/common';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { attribute_names, TxUpgradeHelperService } from 'src/indexers/stacks-indexer/helpers/tx-upgrade-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class UpgradeMegaIndexerService implements IndexerService {
  private readonly logger = new Logger(UpgradeMegaIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txUpgradeHelper: TxUpgradeHelperService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    try {
      let txResult: TxProcessResult = { processed: false, missing: false };

      const robot_asset_name = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'robot_asset_name');
      const component_asset_name = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'component_asset_name');
      const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id');
      const name = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'name');
      const { contract_key } = sc;
      
      const token_id_list: string[] = attribute_names.map(attr_name => {
        return this.stacksTxHelper.extractArgumentData(tx.args, scf, attr_name).toString();
      });

      const nftMeta = await this.txUpgradeHelper.findMetaByAssetNameWithAttr(robot_asset_name, token_id);

      if (nftMeta) {
        const newBot = await this.txUpgradeHelper.findMetasByAssetNameWithAttr(
          component_asset_name, token_id_list
        );
        await this.txUpgradeHelper.upgradeMegapont(nftMeta, newBot, token_id_list, name);

        txResult.processed = true;
      } else {
        this.logger.log(`NftMeta not found ${robot_asset_name} ${token_id}`);
        txResult.missing = true;
      }

      return txResult;
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  async createAction(params: CreateActionTO): Promise<Action> {
    return;
  }
}
