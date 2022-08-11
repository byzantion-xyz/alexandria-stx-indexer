import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { Repository } from 'typeorm';
import { StacksTxHelperService } from "src/indexers/stacks-indexer/providers/stacks-tx-helper.service";
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { Collection } from 'src/database/universal/entities/Collection';

const bnsImageUrl = 'https://byzantion.mypinata.cloud/ipfs/QmVbJqPStxPkpUgCcPBQE1V1SRehceTFjVSzofKp9yUC1x';

@Injectable()
export class BnsRegisterIndexerService implements IndexerService {
  private readonly logger = new Logger(BnsRegisterIndexerService.name);
  
  constructor(
    private txHelper: TxHelperService,
    private stacksTxHelper: StacksTxHelperService,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const namespace: string = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'namespace');
    const name: string  = this.stacksTxHelper.extractArgumentData(tx.args, scf, 'name'); 

    const nftMeta = await this.stacksTxHelper.findMetaBns(name, namespace, sc.id);

    if (!nftMeta) {
      const collection = await this.collectionRepository.findOne({ where: { smart_contract_id: sc.id } });
      const bns = this.nftMetaRepository.create({
        collection_id: collection.id,
        chain_id: sc.chain_id,
        smart_contract_id: sc.id,
        name: name,
        token_id: tx.block_height.toString() + tx.index.toString(),
        asset_name: 'names',
        image: bnsImageUrl,
        nft_state: { minted: true },
        nft_meta_bns: { 
          name: `${name}.${namespace}`, 
          namespace: namespace 
        }
      });
      await this.nftMetaRepository.save(bns); 
    }
    txResult.processed = true;

    return txResult;
  }

  async createAction(params: CreateActionTO): Promise<Action> {
    return;
  }
}
