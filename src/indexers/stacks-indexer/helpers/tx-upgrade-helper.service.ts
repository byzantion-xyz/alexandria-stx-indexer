import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Commission } from 'src/database/universal/entities/Commission';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { NftState } from 'src/database/universal/entities/NftState';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { In, Repository } from 'typeorm';

@Injectable()
export class TxUpgradeHelperService {
  private readonly logger = new Logger(TxUpgradeHelperService.name);

  constructor(
    @InjectRepository(NftState)
    private nftStateRepository: Repository<NftState>,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>
  ) {}
  
  async findMetasByContractKeyWithAttr(contract_key: string, token_ids: string[]) {
    const nft_metas = await this.nftMetaRepository.find({
      where: {
        smart_contract: { contract_key }, 
        token_id: In(token_ids)
      },
      relations: { attributes: true, nft_state: true }
    });

    if (nft_metas.length === token_ids.length) {
      return nft_metas;
    }
  }

  async findMetaByContractKeyWithAttr(contract_key: string, token_id: string) {
    const nft_metas = await this.findMetasByContractKeyWithAttr(contract_key, [token_id]);

    if (nft_metas && nft_metas.length === 1) {
      return nft_metas[0];
    }
  }

  async findMetasByAssetNameWithAttr(asset_name: string, token_ids: string[]) {
    const nft_metas = await this.nftMetaRepository.find({
      where: {
        asset_name: asset_name,
        token_id: In(token_ids)
      },
      relations: { attributes: true, nft_state: true }
    });

    if (nft_metas.length === token_ids.length) {
      return nft_metas;
    }
  }

  async findMetaByAssetNameWithAttr(asset_name: string, token_id: string) {
    const nft_metas = await this.findMetasByAssetNameWithAttr(asset_name, [token_id]);

    if (nft_metas && nft_metas.length === 1) {
      return nft_metas[0];
    }
  }

}
