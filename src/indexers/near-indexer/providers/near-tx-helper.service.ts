import { Injectable, Logger } from '@nestjs/common';
import { NftStateList } from 'src/database/universal/entities/NftStateList';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import { FunctionCall, Receipt } from '../interfaces/near-indexer-tx-event.dto';

@Injectable()
export class NearTxHelperService {
  private readonly logger = new Logger(NearTxHelperService.name);

  isNewerEvent(tx: CommonTx, state_list: NftStateList) { 
    return (
      !state_list ||
      !state_list.list_block_height ||
      tx.block_height > state_list.list_block_height
    );
  }

  nanoToMiliSeconds(nanoseconds: bigint) {
    return Number(BigInt(nanoseconds) / BigInt(1e6));
  }

  parseBase64Arguments(args: string, hash: string) {
    try {
      let json = JSON.parse(Buffer.from(args, 'base64').toString());
      if (json.msg) {
        try {
          json.msg = JSON.parse(json.msg);
        } catch (err) {}
      }
      return json;
    } catch (err) {
      this.logger.warn(`parseBase64Arguments() failed for originating receipt id: ${hash}. `, err);
    }
  }

  findEventData(r: Receipt[], event_name: string): FunctionCall {
    if (!r || !r.length) return undefined;
    
    let receipt = r.find(r => r.function_calls.find(fc => fc.method_name === event_name));
    return receipt ? receipt.function_calls.find(f => f.method_name === event_name) : undefined;
  }

}
