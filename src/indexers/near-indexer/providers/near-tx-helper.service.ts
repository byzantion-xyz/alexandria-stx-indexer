import { Injectable, Logger } from '@nestjs/common';
import { NftState } from 'src/database/universal/entities/NftState';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';

@Injectable()
export class NearTxHelperService {
  private readonly logger = new Logger(NearTxHelperService.name);

  isNewEvent(tx: CommonTx, nft_state: NftState, sc_id: string) {
    if (!nft_state || !nft_state.nft_states_list || !nft_state.nft_states_list.length) {
      return false;
    }
    const nft_list_state = nft_state.nft_states_list.find(s => s.nft_state_id === sc_id);
 
    return (
      !nft_list_state ||
      !nft_list_state.list_block_height ||
      tx.block_height > nft_list_state.list_block_height
    );
  }

  nanoToMiliSeconds(nanoseconds: bigint) {
    return Number(BigInt(nanoseconds) / BigInt(1e6));
  }

  parseBase64Arguments(args: string) {
    try {
      let json = JSON.parse(Buffer.from(args, 'base64').toString());
      if (json.msg) {
        try {
          json.msg = JSON.parse(json.msg);
        } catch (err) {}
      }
      return json;
    } catch (err) {
      this.logger.warn('parseBase64Arguments() failed. ', err);
    }
  }

}
