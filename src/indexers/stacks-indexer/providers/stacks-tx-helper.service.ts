import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { hexToCV, cvToJSON, BufferCV } from '@stacks/transactions';
import { principalCV } from '@stacks/transactions/dist/clarity/types/principalCV';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { Repository } from 'typeorm';
interface FunctionArgs {
  hex: string;
  repr: string;
  name: string;
  type: string;
}

@Injectable()
export class StacksTxHelperService {
  private byzMarketplaces: [string];
  private readonly logger = new Logger(StacksTxHelperService.name);

  constructor(
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    private configService: ConfigService,
  ) {
    this.byzMarketplaces =  this.configService.get("indexer.byzMarketplaceContractKeys");
  }

  parseHexArguments(args: FunctionArgs[]) {
    try {
      let result = {};
      for (let arg of args) {
        if (arg.hex) {
          let data = hexToCV(arg.hex);
          if (Object.keys(data).includes('buffer')) {
            result[arg.name] = (data as BufferCV).buffer.toString();
          } else {
            let json = cvToJSON(data);
            result[arg.name] = json.type === 'uint' ? Number(json.value) : json.value;
          }
        }
      }

      return result;
    } catch (err) {
      this.logger.warn('parseHexArguments() failed. ', err);
    }
  }

  isValidWalletAddress(address: string) {
    try {
      principalCV(address);
      return true;
    } catch (err) {
      return false;
    }
  };

  async findMetaBns(name: string, namespace: string, sc_id?: string): Promise<NftMeta> {
    const nft_meta = await this.nftMetaRepository.findOne({
      where: {
        ... (sc_id && { smart_contract_id: sc_id }),
        name: name,
        nft_meta_bns: { namespace },
      },
      relations: { 
        nft_meta_bns: true, 
        nft_state: true,
        smart_contract: true
      }
    });

    if (nft_meta && nft_meta.nft_meta_bns) {
      return nft_meta;
    }
  }

  isByzMarketplace(sc: SmartContract): boolean {
    return this.byzMarketplaces.includes(sc.contract_key);
  }
}
