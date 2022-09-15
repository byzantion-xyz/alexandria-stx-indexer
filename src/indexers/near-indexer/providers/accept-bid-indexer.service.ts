import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName, BidType, SmartContractType } from 'src/indexers/common/helpers/indexer-enums';
import { TxBidHelperService } from 'src/indexers/common/helpers/tx-bid-helper.service';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateAcceptBidActionTO, CreateActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { NearTxHelperService } from './near-tx-helper.service';

const NFT_BUY_EVENT = 'nft_transfer_payout';
const RESOLVE_OFFER = 'resolve_offer';

@Injectable()
export class AcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(AcceptBidIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private nearTxHelper: NearTxHelperService,
    private txBidHelper: TxBidHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const payout = this.nearTxHelper.findEventData(tx.receipts, NFT_BUY_EVENT);
    const receipt = this.nearTxHelper.findReceiptWithEvent(tx.receipts, RESOLVE_OFFER);
    if (!payout || !receipt) {
      this.logger.debug(`No ${NFT_BUY_EVENT} found for tx hash: ${tx.hash}`);
      txResult.processed = true;
      return txResult;
    }

    const token_id = this.txHelper.extractArgumentData(tx.args, scf, 'token_id'); 
    const price = this.txHelper.extractArgumentData(tx.args, scf, "price");
    const buyer = this.txHelper.extractArgumentData(tx.args, scf, 'buyer');
    const contract_key = sc.contract_key;

    const msc = await this.smartContractRepository.findOneBy({ contract_key: receipt.receiver_id });
    if (!msc) {
      this.logger.log(`Marketplace smart_contract: ${receipt.receiver_id} not found`);
      txResult.missing = true;
      return txResult;
    }

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      await this.txHelper.unlistMetaInAllMarkets(nftMeta, tx, msc);

      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.accept_bid, tx, nftMeta, msc);
      const acceptBidActionParams: CreateAcceptBidActionTO = {
        ...actionCommonArgs,
        bid_price: price,
        buyer: buyer,
        seller: tx.signer
      };
      await this.createAction(acceptBidActionParams);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);

      this.logger.log(`New action ${params.action}: ${saved.id} `);

      return saved;
    } catch (err) {}
  }

}
