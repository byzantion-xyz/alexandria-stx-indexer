export interface Receipt {

    id: string;

    predecessor_id: string;
    signer_id: string;
    receiver_id: string;

    status: string;
    result: string;

    function_calls: FunctionCall[];
    logs: string[];

    receipts?: Receipt[];
    originating_receipt_id: string;
}

export interface FunctionCall {

    method_name: string;
    args: any;
}

export interface NftOrFtEvent {

    standard: string,
    event: string,
    data: JSON
}