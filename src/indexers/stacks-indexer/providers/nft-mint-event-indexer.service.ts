import { Injectable, Logger } from '@nestjs/common';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateMintActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class NftMintEventIndexerService implements IndexerService {
  private readonly logger = new Logger(NftMintEventIndexerService.name);
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
    const contract_key = this.stacksTxHelper.extractContractKeyFromNftEvent(event);
    const buyer = event.asset.recipient;
    const price = this.stacksTxHelper.findAndExtractMintPrice(event, tx.events);

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.mint, tx, nftMeta, sc);
      const mintActionParams: CreateMintActionTO = { 
        ...actionCommonArgs,
        buyer,
        list_price: price
      };

      if (!nftMeta.nft_state || !nftMeta.nft_state.minted) {
        await this.txHelper.mintMeta(nftMeta, tx, buyer);
      }
  
      await this.createAction(mintActionParams);

      txResult.processed = true;
    } else {
      this.logger.debug(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }
  
  async createAction(params: CreateMintActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
