import { Injectable, Logger } from '@nestjs/common';
import { NftStateList } from 'src/database/universal/entities/NftStateList';
import { CommonTx } from 'src/indexers/common/interfaces/common-tx.interface';
import {IndexerTxEvent} from "../../../database/near-stream/entities/IndexerTxEvent";
import {FunctionCall, NftOrFtEvent, Receipt} from "../interfaces/near-indexer-tx-event.dto";
import * as _ from 'lodash';

export const NEAR_EVENT_PREFIX = "EVENT_JSON:";

const flatten = (item) => [item, _.flatMapDeep(item.receipts, flatten)];

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
    const receipt = this.findReceiptWithFunctionCall(r, event_name);
    return receipt ? receipt.function_calls.find(f => f.method_name === event_name) : undefined;
  }

  flatMapReceipts(r: Receipt[]): Receipt[] {
    return _.flatMapDeep(r, flatten);
  }

  findReceiptWithFunctionCall(r: Receipt[], method_name: string): Receipt {
    return _.flatMapDeep(r, flatten)
      .find(r => r && r.function_calls.find(fc => fc.method_name === method_name));
  }

  isReceiptForEvent(r: Receipt, event_name: string): boolean {
    return r.function_calls.some(fc => fc.method_name === event_name);
  }

  getEvents(rcpt: Receipt, acc: [NftOrFtEvent, Receipt][] = []) : [NftOrFtEvent, Receipt][] {
      rcpt.logs.forEach((l) => {
        if (l.startsWith(NEAR_EVENT_PREFIX)) {
            try {
              const event: NftOrFtEvent = JSON.parse(l.replace(NEAR_EVENT_PREFIX, ''))
              acc.push([event, rcpt]);
             } catch (err) {
              this.logger.warn(`getEvents() failed to parse JSON for receipt: ${rcpt.id}`);
              this.logger.warn(err);
            }
        }
      });

      rcpt.receipts?.forEach((r) => {
        this.getEvents(r, acc);
      });

      return acc;
  }

    getLogs(rcpt: Receipt, acc: string[] = []) : string[] {
        rcpt.logs.forEach((l) => acc.push(l));

        rcpt.receipts?.forEach((r) => {
            this.getLogs(r, acc);
        });

        return acc;
    }

}
