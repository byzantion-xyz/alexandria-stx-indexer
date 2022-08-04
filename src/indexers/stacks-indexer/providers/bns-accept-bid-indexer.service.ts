import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateAcceptBidActionTO, CreateActionTO, CreateUnlistBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class BnsAcceptBidIndexerService implements IndexerService {
  private readonly logger = new Logger(BnsAcceptBidIndexerService.name);

  constructor(
    private stacksTxHelper: StacksTxHelperService,
    private txHelper: TxHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}
  
  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const name = this.txHelper.extractArgumentData(tx.args, scf, 'name');
    const namespace = this.txHelper.extractArgumentData(tx.args, scf, 'namespace');

    const nftMeta = await this.stacksTxHelper.findMetaBns(name, namespace);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.accept_bid, tx, nftMeta, sc);
      const acceptBidActionParams: CreateAcceptBidActionTO = {
        ...actionCommonArgs,
        bid_price: nftMeta.nft_state && nftMeta.nft_state.bid_price ? nftMeta.nft_state.bid_price : undefined,
        buyer: nftMeta.nft_state?.bid_buyer || undefined,
        seller: tx.signer
      };

      if (this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
        await this.txHelper.unlistBidMeta(nftMeta.id, tx);
      } else {
        this.logger.log(`Too Late`);
      }
      await this.createAction(acceptBidActionParams);
      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found`);
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
