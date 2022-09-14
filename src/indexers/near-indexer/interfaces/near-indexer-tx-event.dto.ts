export interface Transaction {

    hash: string;
    nonce: bigint;

    signer_id: string;
    receiver_id: string;

    receipts: Array<Receipt>;
    contains_event: boolean;

    block_hash: string;
    block_height: bigint;
    block_timestamp: bigint;
}

export interface Receipt {

    id: string;

    predecessor_id: string;
    signer_id: string;
    receiver_id: string;

    status: string;
    result: string;

    function_calls: Array<FunctionCall>;
    logs: Array<string>;

    originating_receipt_id?: string;
}

export interface FunctionCall {

    method_name: string;
    args: string;
}