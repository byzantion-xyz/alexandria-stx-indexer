import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateUnlistBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class BnsUnlistBidIndexerService implements IndexerService {
  private readonly logger = new Logger(BnsUnlistBidIndexerService.name);

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
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.unlist_bid, tx, nftMeta, sc);
      const unlistBidActionParams: CreateUnlistBidActionTO = {
        ...actionCommonArgs,
        bid_price: nftMeta.nft_state && nftMeta.nft_state.list_price ? nftMeta.nft_state.list_price : undefined,
        buyer: nftMeta.nft_state?.list_seller || undefined
      };

      if (this.txHelper.isNewBid(tx, nftMeta.nft_state)) {
        await this.txHelper.unlistBidMeta(nftMeta.id, tx);
        await this.createAction(unlistBidActionParams);
      } else {
        this.logger.log(`Too Late`);
        // Create missing action
        await this.createAction(unlistBidActionParams);
      }
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
