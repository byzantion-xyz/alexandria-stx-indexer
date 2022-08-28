export interface FunctionCallEvent {
  originating_receipt_id: string;
  signer_id: string;
  receiver_id: string;
  method: string;
  args: string;
  executed_block_hash: string;
  executed_block_height: bigint;
  executed_block_timestamp: bigint;
}