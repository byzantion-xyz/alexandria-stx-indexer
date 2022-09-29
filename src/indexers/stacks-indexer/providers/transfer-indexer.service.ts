import { Injectable, Logger } from "@nestjs/common";
import { Action } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { CreateTransferActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";

import { ActionName } from "src/indexers/common/helpers/indexer-enums";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { StacksTxHelperService } from "./stacks-tx-helper.service";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";

@Injectable()
export class TransferIndexerService implements IndexerService {
  private readonly logger = new Logger(TransferIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const contract_key = sc.contract_key;
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'token_id');
    const seller = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'seller');
    const buyer = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'buyer');

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      if (!isNaN(token_id) &&
        this.stacksTxHelper.isValidWalletAddress(seller) &&
        this.stacksTxHelper.isValidWalletAddress(buyer)
      ) {
        const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.transfer, tx, nftMeta);
        const listActionParams: CreateTransferActionTO = {
          ...actionCommonArgs,
          buyer,
          seller,
        };

        await this.createAction(listActionParams);
        txResult.processed = true;
      } else {
        this.logger.log(
          `-------non standard transfer-------- ${sc.contract_key}`
        );
        txResult.missing = true;
      }
    } else {
      this.logger.debug(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateTransferActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
