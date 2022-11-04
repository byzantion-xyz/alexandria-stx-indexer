import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { StacksTxHelperService } from './stacks-tx-helper.service';
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SetSuitMappingIndexerService implements IndexerService {
  marketScs?: SmartContract[];
  stakingScs?: SmartContract[];
  
  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private config: ConfigService,
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    const txResult: TxProcessResult = { processed: false, missing: false };
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id');
    const contract_key = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'contract_key');
    const asset_name = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'asset_name');

    axios.post(
      this.config.get("app.stacksScrapeUrl"),
      {token_id, contract_key, asset_name},
      {
        headers: {
        "x-api-key": process.env.BYZ_API_KEY,
        }
      }
    );

    txResult.processed = true;

    return txResult;
  }
  
  async createAction(params: CreateActionTO): Promise<Action> {
    return;
  }
}
