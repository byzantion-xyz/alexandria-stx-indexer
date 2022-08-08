import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action } from 'src/database/universal/entities/Action';
import { NftState } from 'src/database/universal/entities/NftState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { TxUpgradeHelperService } from 'src/indexers/stacks-indexer/helpers/tx-upgrade-helper.service';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { CreateActionTO, CreateListActionTO } from 'src/indexers/common/interfaces/create-action-common.dto';
import { IndexerService } from 'src/indexers/common/interfaces/indexer-service.interface';
import { TxProcessResult } from 'src/indexers/common/interfaces/tx-process-result.interface';
import { MissingCollectionService } from 'src/scrapers/near-scraper/providers/missing-collection.service';
import { Repository } from 'typeorm';
import { MegapontAttribute } from 'src/database/universal/entities/MegapontAttribute';
import { NftMetaAttribute } from 'src/database/universal/entities/NftMetaAttribute';
import { NftMeta } from 'src/database/universal/entities/NftMeta';

const attribute_names = ['mouth', 'jewellery', 'head', 'eyes', 'ears', 'body', 'background'];

@Injectable()
export class UpgradeMegaIndexerService implements IndexerService {
  private readonly logger = new Logger(UpgradeMegaIndexerService.name);

  constructor(
    private txHelper: TxHelperService,
    private txUpgradeHelper: TxUpgradeHelperService,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    @InjectRepository(NftMetaAttribute)
    private nftMetaAttributeRepository: Repository<NftMetaAttribute>
  ) {}

  async process(tx: CommonTx, sc: SmartContract, scf: SmartContractFunction): Promise<TxProcessResult> {
    this.logger.debug(`process() ${tx.hash}`);
    let txResult: TxProcessResult = { processed: false, missing: false };

    const robot_asset_name = this.txHelper.extractArgumentData(tx.args, scf, 'robot_asset_name');
    const component_asset_name = this.txHelper.extractArgumentData(tx.args, scf, 'component_asset_name');
    const token_id = this.txHelper.extractArgumentData(tx.args, scf, 'token_id');
    const name = this.txHelper.extractArgumentData(tx.args, scf, 'name');
    const { contract_key } = sc;
    
    const token_id_list: string[] = attribute_names.map(attr_name => {
      return this.txHelper.extractArgumentData(tx.args, scf, attr_name);
    });

    const nftMeta = await this.txUpgradeHelper.findMetaByAssetNameWithAttr(robot_asset_name, token_id);

    if (nftMeta) {
      const newBot = await this.txUpgradeHelper.findMetasByAssetNameWithAttr(component_asset_name, token_id_list);
      this.logger.log('newBot', newBot);

      nftMeta.attributes = nftMeta.attributes.filter(attr => 
        !attr.megapont_attribute?.trait_group && attr.trait_type !== 'Trait Count'
      );

      const newAttributes = attribute_names.map(attr_name => {
        const metaAttr = newBot.find(meta => meta.token_id === token_id_list[attribute_names.indexOf(attr_name)]);
        return {
          trait_type: metaAttr.attributes[0].trait_type,
          value: metaAttr.attributes[0].value,
          scanned: false,
          megapont_attribute: {
            trait_group: metaAttr.attributes[0].trait_type ? 'Component' : null,
            token_id: metaAttr.token_id,
            sequence: metaAttr.attributes[1].value
          }
        };
      });

      for (let attr of newAttributes) {
        if (!attr.scanned && attr.megapont_attribute.trait_group) {
          nftMeta.attributes.push(this.nftMetaAttributeRepository.create(attr));
          
          let burn = newBot.find(meta => meta.token_id === attr.megapont_attribute.token_id);
          if (!burn.nft_state.burned) {
            await this.txHelper.burnMeta(burn.id);
          } else {
            this.logger.log('Already burned ', burn.name, burn.token_id);
          }
        }
      }

      nftMeta.attributes.push(this.nftMetaAttributeRepository.create({
        trait_type: 'Trait Count',
        value: nftMeta.attributes.length.toString(),
        rarity: 1,
        score: 1
      }));
      if (name) nftMeta.name = name.replace(/^"(.+(?="$))"$/, '$1');

      await this.nftMetaRepository.save(nftMeta);
      this.logger.log('attr', newAttributes);

      txResult.processed = true;
    } else {
      this.logger.log(`NftMeta not found ${contract_key} ${token_id}`);
      txResult.missing = true;
    }

    return txResult;
  }

  async createAction(params: CreateListActionTO): Promise<Action> {
    try {
      const action = this.actionRepository.create(params);
      const saved = await this.actionRepository.save(action);
      this.logger.log(`New action ${params.action}: ${saved.id} `);
      return saved;
    } catch (err) {}
  }
}
