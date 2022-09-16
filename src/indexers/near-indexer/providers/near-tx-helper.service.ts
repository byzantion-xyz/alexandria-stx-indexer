import { Injectable, Logger } from '@nestjs/common';
import { NftStateList } from 'src/database/universal/entities/NftStateList';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import {IndexerTxEvent} from "../../../database/near-stream/entities/IndexerTxEvent";
import {FunctionCall, Receipt} from "../interfaces/near-indexer-tx-event.dto";


@Injectable()
export class NearTxHelperService {

  isNewerEvent(tx: CommonTx, state_list: NftStateList) {
    return (
      !state_list ||
      !state_list.list_block_height ||
      tx.block_height > state_list.list_block_height
    );
  }

  getReceiptTree(tx: IndexerTxEvent) : Receipt[] {
    const receipts = tx.receipts.map((r) => {
      const rcpt = Object.assign({} as Receipt, r);

      rcpt.function_calls
          .forEach((fc) => fc.args = this.decodeBase64Args(fc.args));

      return rcpt;
    });

    const groups = receipts.reduce((acc, r) => {
      acc[r.originating_receipt_id] = acc[r.originating_receipt_id] || [];
      acc[r.originating_receipt_id].push(r);

      return acc;
    }, {});

    receipts.forEach((r) => {
      r.receipts = groups[r.id];
    })

    return groups['null'];
  }

  decodeBase64Args(args: string) : any {
    const decoded =   Buffer.from(args, 'base64').toString();

    try {
        const json = JSON.parse(decoded);

        if (json.msg) {
            try {
                json.msg = JSON.parse(json.msg);
            } catch (e) {}
        }

        return json
    } catch (e) {
        return decoded;
    }
  }

  findEventData(r: Receipt[], event_name: string): FunctionCall {
    const receipt = this.findReceiptWithEvent(r, event_name);
    return receipt ? receipt.function_calls.find(f => f.method_name === event_name) : undefined;
  }

  findReceiptWithEvent(r: Receipt[], event_name: string): Receipt {
    if (!r || !r.length) return undefined;
    let receipt = r.find(r => r.receipts.find(r => r.function_calls.find(fc => fc.method_name === event_name)));

    return receipt && receipt.receipts && receipt.receipts[0] ? receipt.receipts[0] : undefined;
  }

}
