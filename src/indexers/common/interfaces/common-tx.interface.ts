import {TransactionEvent as StacksTransactionEvent} from "@stacks/stacks-blockchain-api-types";
import {Receipt as NearReceipt} from "../../near-indexer/interfaces/near-indexer-tx-event.dto";

export interface CommonTx {
    hash: string;

    block_hash: string;
    block_timestamp?: number;
    block_height: bigint;

    nonce?: bigint;
    index?: bigint;
    signer: string;
    receiver: string;

    function_name: string;
    indexer_name?: string;
    args: any;

    events?: StacksTransactionEvent[];
    receipts?: NearReceipt[];
}
