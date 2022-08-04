import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { NftState } from 'src/database/universal/entities/NftState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { ListBotService } from 'src/discord-bot/providers/list-bot.service';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';
import { NftStateArguments, TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateRelistActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';

@Injectable()
export class ChangePriceIndexerService implements IndexerService {
  private readonly logger = new Logger(ChangePriceIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private listBotService: ListBotService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(NftState)
    private nftStateRepository: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const second_market = this.txHelper.extractArgumentData(tx.args, scf, 'second_market');
    const token_id = this.txHelper.extractArgumentData(tx.args, scf, "token_id");
    const price = this.txHelper.extractArgumentData(tx.args, scf, "price");
    const contract_key = this.txHelper.extractArgumentData(tx.args, scf, "contract_key");
    const collection_map_id = this.txHelper.extractArgumentData(tx.args, scf, "collection_map_id");

    const nftMeta = await this.txHelper.findMetaByContractKey(contract_key, token_id);

    if (nftMeta) {
      const list_sc = await this.smartContractRepository.findOne({ where: { contract_key: second_market }});
      const commission_id = await this.txHelper.findCommissionByKey(list_sc, contract_key);
      const actionCommonArgs = this.txHelper.setCommonActionParams(ActionName.relist, tx, nftMeta, sc);
      const relistActionParams: CreateRelistActionTO = {
        ...actionCommonArgs,
        list_price: price,
        seller: tx.signer,
        ... (commission_id && { commission_id })
      };

      if (this.txHelper.isNewNftListOrSale(tx, nftMeta.nft_state)) {
        const args: NftStateArguments = {
          collection_map_id: collection_map_id || contract_key || null
        };
        await this.txHelper.listMeta(nftMeta.id, tx, list_sc, price, commission_id, args);

        await this.createAction(relistActionParams);
      } else {
        this.logger.log(`Too Late`);
        await this.createAction(relistActionParams);
      }

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
