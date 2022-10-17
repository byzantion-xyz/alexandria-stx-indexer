import { Injectable, Logger } from '@nestjs/common';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateUnlistBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { TxActionService } from 'src/indexers/common/providers/tx-action.service';

@Injectable()
export class UnlistBidIndexerService implements IndexerService {
  private readonly logger = new Logger(UnlistBidIndexerService.name);

  constructor (
    private txActionService: TxActionService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService
  ) {}

  async process(tx: CommonTx, msc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, 'contract_key');
    const token_id = this.txHelper.findAndExtractArgumentData(tx.args, scf, ['token_id', 'token_series_id']);
    const buyer = tx.signer;

    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, msc.chain_id);

    const bidState = await this.txBidHelper.findActiveSoloBid(nftMeta, msc, buyer);
    const actionCommonArgs = this.txHelper.setCommonActionParams(
      ActionName.unlist_bid, tx, nftMeta, msc
    );
    const actionParams: CreateUnlistBidActionTO = {
      ...actionCommonArgs,
      bid_price: bidState?.bid_price,
      buyer: buyer
    };

    if (bidState && this.txBidHelper.isNewBid(tx, bidState)) {
      await this.txBidHelper.cancelBid(bidState, tx);

      await this.createAction(actionParams);

      txResult.processed = true;
    } else if (bidState) {
      this.logger.debug('Too Late');
      await this.createAction(actionParams);
      txResult.processed = true;
    } else {
      this.logger.warn(`bid_state not found ${contract_key} ${token_id} ${buyer} ${msc.contract_key} `);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateUnlistBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }

}
