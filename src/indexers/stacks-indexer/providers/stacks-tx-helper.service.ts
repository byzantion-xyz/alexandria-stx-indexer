import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { TransactionEvent, TransactionEventSmartContractLog } from "@stacks/stacks-blockchain-api-types";
import { BufferCV } from "@stacks/transactions";
import { principalCV } from "@stacks/transactions/dist/clarity/types/principalCV";
import { cvToTrueValue, hexToCV, cvToJSON } from "micro-stacks/clarity";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { NftStateList } from "src/database/universal/entities/NftStateList";
import { SmartContractFunction } from "src/database/universal/entities/SmartContractFunction";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { CommonTx } from "src/indexers/common/interfaces/common-tx.interface";
import { Repository } from "typeorm";
interface FunctionArgs {
  hex: string;
  repr: string;
  name: string;
  type: string;
}

export type TransactionEventSmartContractLogWithData = TransactionEventSmartContractLog & {
  data: {
    trait: string;
    action: string;
    data: any;
    order: bigint;
    type: string;
  };
};

@Injectable()
export class StacksTxHelperService {
  // private byzOldMarketplaces: [string];
  private readonly logger = new Logger(StacksTxHelperService.name);

  constructor(
    private txHelper: TxHelperService,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    private configService: ConfigService
  ) {}

  parseHexArguments(args: FunctionArgs[]) {
    try {
      let result = [];
      for (let arg of args) {
        if (arg.hex) {
          let data = hexToCV(arg.hex);
          if (Object.keys(data).includes("buffer")) {
            result.push((data as BufferCV).buffer.toString());
          } else {
            let json = cvToJSON(data);
            result.push(json.type === "uint" ? Number(json.value) : json.value);
          }
        }
      }
      return result;
    } catch (err) {
      this.logger.warn("parseHexArguments() failed. ", err);
    }
  }

  extractArgumentData(args: [], scf: SmartContractFunction, field: string) {
    const index = scf.args[field];
    if (typeof index === "undefined") {
      return undefined;
    } else if (!isNaN(index)) {
      return args[index];
    } else {
      return index;
    }
  }

  isNewerEvent(tx: CommonTx, state_list: NftStateList): boolean {
    return (
      !state_list ||
      !state_list.list_block_height ||
      tx.block_height > state_list.list_block_height ||
      (tx.block_height === state_list.list_block_height &&
        tx.sub_block_sequence &&
        tx.sub_block_sequence > state_list.list_sub_block_seq) ||
      (tx.block_height === state_list.list_block_height &&
        tx.sub_block_sequence === state_list.list_sub_block_seq &&
        tx.index &&
        tx.index > state_list.list_tx_index)
    );
  }

  extractSmartContractLogEvents(events: TransactionEvent[]): TransactionEventSmartContractLogWithData[] {
    try {
      let smart_contract_logs: TransactionEventSmartContractLogWithData[] = [];
      for (let e of events) {
        if (e.event_type === "smart_contract_log" && e.contract_log.value.hex) {
          let data: any = cvToTrueValue(hexToCV(e.contract_log.value.hex));
          smart_contract_logs.push({ ...e, data });
        }
      }
      return smart_contract_logs;
    } catch (err) {
      this.logger.warn("extractSmartContractLogEvents() failed.", err);
    }
  }

  isValidWalletAddress(address: string) {
    try {
      principalCV(address);
      return true;
    } catch (err) {
      return false;
    }
  }

  extractContractKeyFromEvent(e: TransactionEventSmartContractLogWithData): string {
    return e.data.data["collection-id"].split("::")[0].replace("'", "");
  }

  extractAndParseContractKey(args: [], scf: SmartContractFunction, field: string = "contract_key"): string {
    let contract_key = this.extractArgumentData(args, scf, field);
    if (contract_key.includes(":")) contract_key = contract_key.split(":")[0];
    if (contract_key.includes("'")) contract_key.replace("'", "");

    return contract_key;
  }
}
