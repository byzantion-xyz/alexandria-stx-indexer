import { Injectable, Logger } from "@nestjs/common";
import { Action, ActionName } from "src/database/universal/entities/Action";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { TxBidHelperService } from "src/indexers/common/helpers/tx-bid-helper.service";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { CreateAcceptBidActionTO } from "src/indexers/common/interfaces/create-action-common.dto";
import { IndexerService } from "src/indexers/common/interfaces/indexer-service.interface";
import { TxProcessResult } from "src/indexers/common/interfaces/tx-process-result.interface";
import { TxActionService } from "src/indexers/common/providers/tx-action.service";
import { StacksTxHelperService } from "./stacks-tx-helper.service";

@Injectable()
export class AcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(AcceptBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    private txBidHelper: TxBidHelperService,
    private txActionService: TxActionService
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    let txResult: TxProcessResult = { processed: false, missing: false };

    if (!this.stacksTxHelper.isByzOldMarketplace(sc)) {
      txResult.missing = true;
      return txResult;
    }

    const contract_key = this.stacksTxHelper.extractAndParseContractKey(tx.args, scf);
    const token_id = this.stacksTxHelper.extractArgumentData(tx.args, scf, "token_id");
    const buyer = this.stacksTxHelper.findAndExtractNftRecipient(tx.events);
    const price = this.stacksTxHelper.findAndExtractSalePriceFromEvents(tx.events);

    const nftMeta = await this.txHelper.createOrFetchMetaByContractKey(contract_key, token_id, sc.chain_id);

    const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.accept_bid, tx, nftMeta, sc);
    const acceptBidActionParams: CreateAcceptBidActionTO = {
      ...actionCommonArgs,
      bid_price: price,
      buyer: buyer,
      seller: tx.signer,
    };

    let bidState = await this.txBidHelper.findActiveSoloBid(nftMeta, sc, buyer);
    if (bidState && this.txBidHelper.isNewBid(tx, bidState)) {
      await this.txBidHelper.acceptSoloBid(bidState, tx);

      await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, sc, bidState.bid_seller);
    }

    await this.createAction(acceptBidActionParams);
    txResult.processed = true;

    return txResult;
  }

  async createAction(params: CreateAcceptBidActionTO): Promise<Action> {
    return await this.txActionService.saveAction(params);
  }
}
