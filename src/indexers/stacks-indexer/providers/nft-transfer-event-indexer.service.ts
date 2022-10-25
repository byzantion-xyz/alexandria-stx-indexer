import { Injectable, Logger } from '@nestjs/common';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateTransferActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class NftTransferEventIndexerService implements IndexerService {
  private readonly logger = new Logger(NftTransferEventIndexerService.name);
  readonly marketScs?: SmartContract[];
  readonly stakingScs?: SmartContract[];
  
  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    private txActionService: TxActionService,
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const event = this.stacksTxHelper.findNftEventByIndex(tx.events, tx.args.event_index);
    const token_id = this.stacksTxHelper.extractTokenIdFromNftEvent(event);
    const contract_key = event.asset.asset_id;
    const seller = event.asset.sender;
    const buyer = event.asset.recipient;
    
    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionArgs = this.txHelper.setCommonActionParams(ActionName.transfer, tx, nftMeta);
      const transferParams: CreateTransferActionTO = {
        ...actionArgs,
        buyer,
        seller,
      };

      if (this.txHelper.isListedPreviously(nftMeta.nft_state, tx)) {
        await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx);
      }

      if (this.txHelper.isNewOwnerEvent(tx, nftMeta.nft_state, buyer)) {
        await this.txHelper.setNewMetaOwner(nftMeta, tx, buyer);
      }

      await this.createAction(transferParams);

      txResult.processed = true;
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
