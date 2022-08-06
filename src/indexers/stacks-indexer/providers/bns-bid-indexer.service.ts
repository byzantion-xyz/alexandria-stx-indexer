import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateBidActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from './stacks-tx-helper.service';

@Injectable()
export class BnsBidIndexerService implements IndexerService {
  private readonly logger = new Logger(BnsBidIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const namespace: string = this.txHelper.extractArgumentData(tx.args, scf, 'namespace');
    const name: string  = this.txHelper.extractArgumentData(tx.args, scf, 'name'); 
    const price = this.txHelper.extractArgumentData(tx.args, scf, 'bid_price');

    const nftMeta = await this.stacksTxHelper.findMetaBns(name, namespace);

    if (nftMeta) {
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.bid, tx, nftMeta, sc);
      const bidActionParams: CreateBidActionTO = {
        ...actionCommonArgs,
        bid_price: price,
        buyer: tx.signer
      };

      if (this.txHelper.isNewBid(tx, nftMeta.nft_state)) {
        await this.txHelper.bidMeta(nftMeta.id, tx, sc, price);
      } else {
        this.logger.log(`Too Late`);        
      }
      await this.createAction(bidActionParams);

      txResult.processed = true;
    } else {
      this.logger.log(`Missing bns Bid ${tx.hash}`);
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
