import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEvent, TransactionEventSmartContractLog } from '@stacks/stacks-blockchain-api-types';
import { BufferCV } from '@stacks/transactions';
import { principalCV } from '@stacks/transactions/dist/clarity/types/principalCV';
import { cvToTrueValue, hexToCV, cvToJSON } from 'micro-stacks/clarity';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { SmartContractFunction } from 'src/database/universal/entities/SmartContractFunction';
import { TxHelperService } from 'src/indexers/common/helpers/tx-helper.service';
import { Repository } from 'typeorm';
interface FunctionArgs {
  hex: string;
  repr: string;
  name: string;
  type: string;
}

export type TransactionEventSmartContractLogWithData = TransactionEventSmartContractLog & { 
  data: {
    trait: string,
    action: string,
    data: any,
    order: bigint,
    type: string
  }
};

@Injectable()
export class StacksTxHelperService {
  private byzOldMarketplaces: [string];
  private readonly logger = new Logger(StacksTxHelperService.name);

  constructor(
    private txHelper: TxHelperService,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    private configService: ConfigService,
  ) {
    this.byzOldMarketplaces =  this.configService.get("indexer.byzOldMarketplaceContractKeys");
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

  extractSmartContractLogEvents(events: TransactionEvent[]): TransactionEventSmartContractLogWithData[] {
    try {
      let smart_contract_logs: TransactionEventSmartContractLogWithData[] = [];
      for (let e of events) {
        if (e.event_type === 'smart_contract_log' && e.contract_log.value.hex) {
          let data: any = cvToTrueValue(hexToCV(e.contract_log.value.hex));
          smart_contract_logs.push({ ...e, data });
        }
      }
      return smart_contract_logs;
    } catch (err) {
      this.logger.warn('extractSmartContractLogEvents() failed.', err);
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

  isByzOldMarketplace(sc: SmartContract): boolean {
    return this.byzOldMarketplaces.includes(sc.contract_key);
  }

  extractContractKeyFromEvent(e: TransactionEventSmartContractLogWithData): string {
    return e.data.data['collection-id'].split('::')[0].replace("'", '')
  }

  extractAndParseContractKey(args: JSON, scf: SmartContractFunction, field: string = 'contract_key'): string {
    let contract_key = this.txHelper.extractArgumentData(args, scf, field);
    if (contract_key.includes(':')) contract_key = contract_key.split(':')[0];
    if (contract_key.includes("'")) contract_key.replace("'", "");

    return contract_key;
  }
}

