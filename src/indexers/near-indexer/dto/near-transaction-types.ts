/**
 * Model ReceiptsExecutionOutcome
 * 
 */
 export type ReceiptsExecutionOutcome = {
  block_hash: string
  id: string
  outcome: ReceiptsExecutionOutcomeOutcome
  proof: ReceiptsExecutionOutcomeProof[]
}

/**
 * Model ReceiptsExecutionOutcomeOutcome
 * 
 */
export type ReceiptsExecutionOutcomeOutcome = {
  executor_id: string
  gas_burnt: bigint
  logs: string[]
  metadata: ReceiptsExecutionOutcomeOutcomeMetadata
  receipt_ids: string[]
  status: ReceiptsExecutionOutcomeOutcomeStatus
  tokens_burnt: string
}

/**
 * Model ReceiptsExecutionOutcomeOutcomeMetadata
 * 
 */
export type ReceiptsExecutionOutcomeOutcomeMetadata = {
  gas_profile: ReceiptsExecutionOutcomeOutcomeMetadataGasProfile[]
  version: bigint
}

/**
 * Model ReceiptsExecutionOutcomeOutcomeMetadataGasProfile
 * 
 */
export type ReceiptsExecutionOutcomeOutcomeMetadataGasProfile = {
  cost: string
  cost_category: string
  gas_used: string
}

/**
 * Model ReceiptsExecutionOutcomeOutcomeStatus
 * 
 */
export type ReceiptsExecutionOutcomeOutcomeStatus = {
  Failure: ReceiptsExecutionOutcomeOutcomeStatusFailure | null
  SuccessValue: string | null
}

/**
 * Model ReceiptsExecutionOutcomeOutcomeStatusFailure
 * 
 */
export type ReceiptsExecutionOutcomeOutcomeStatusFailure = {
  ActionError: ReceiptsExecutionOutcomeOutcomeStatusFailureActionError
}

/**
 * Model ReceiptsExecutionOutcomeOutcomeStatusFailureActionError
 * 
 */
export type ReceiptsExecutionOutcomeOutcomeStatusFailureActionError = {
  index: bigint
  kind: ReceiptsExecutionOutcomeOutcomeStatusFailureActionErrorKind
}

/**
 * Model ReceiptsExecutionOutcomeOutcomeStatusFailureActionErrorKind
 * 
 */
export type ReceiptsExecutionOutcomeOutcomeStatusFailureActionErrorKind = {
  FunctionCallError: ReceiptsExecutionOutcomeOutcomeStatusFailureActionErrorKindFunctionCallError
}

/**
 * Model ReceiptsExecutionOutcomeOutcomeStatusFailureActionErrorKindFunctionCallError
 * 
 */
export type ReceiptsExecutionOutcomeOutcomeStatusFailureActionErrorKindFunctionCallError = {
  ExecutionError: string
}

/**
 * Model ReceiptsExecutionOutcomeProof
 * 
 */
export type ReceiptsExecutionOutcomeProof = {
  direction: string
  hash: string
}

/**
 * Model ReceiptsReceipt
 * 
 */
export type ReceiptsReceipt = {
  predecessor_id: string
  receipt: ReceiptsReceiptReceipt
  receipt_id: string
  receiver_id: string
}

/**
 * Model ReceiptsReceiptReceipt
 * 
 */
export type ReceiptsReceiptReceipt = {
  Action: ReceiptsReceiptReceiptAction
}

/**
 * Model ReceiptsReceiptReceiptAction
 * 
 */
export type ReceiptsReceiptReceiptAction = {
  actions: ReceiptsReceiptReceiptActionActions[]
  gas_price: string
  input_data_ids: JSON | null
  output_data_receivers: JSON | null
  signer_id: string
  signer_public_key: string
}

/**
 * Model ReceiptsReceiptReceiptActionActions
 * 
 */
export type ReceiptsReceiptReceiptActionActions = {
  FunctionCall: ReceiptsReceiptReceiptActionActionsFunctionCall
}

/**
 * Model ReceiptsReceiptReceiptActionActionsFunctionCall
 * 
 */
export type ReceiptsReceiptReceiptActionActionsFunctionCall = {
  args: string
  deposit: string
  gas: bigint
  method_name: string
}

/**
 * Model TransactionsOutcome
 * 
 */
export type TransactionsOutcome = {
  execution_outcome: TransactionsOutcomeExecutionOutcome
  receipt: JSON | null
}

/**
 * Model TransactionsOutcomeExecutionOutcome
 * 
 */
export type TransactionsOutcomeExecutionOutcome = {
  block_hash: string
  id: string
  outcome: TransactionsOutcomeExecutionOutcomeOutcome
  proof: TransactionsOutcomeExecutionOutcomeProof[]
}

/**
 * Model TransactionsOutcomeExecutionOutcomeOutcome
 * 
 */
export type TransactionsOutcomeExecutionOutcomeOutcome = {
  executor_id: string
  gas_burnt: bigint
  logs: JSON | null
  metadata: TransactionsOutcomeExecutionOutcomeOutcomeMetadata
  receipt_ids: string[]
  status: TransactionsOutcomeExecutionOutcomeOutcomeStatus
  tokens_burnt: string
}

/**
 * Model TransactionsOutcomeExecutionOutcomeOutcomeMetadata
 * 
 */
export type TransactionsOutcomeExecutionOutcomeOutcomeMetadata = {
  gas_profile: JSON | null
  version: bigint
}

/**
 * Model TransactionsOutcomeExecutionOutcomeOutcomeStatus
 * 
 */
export type TransactionsOutcomeExecutionOutcomeOutcomeStatus = {
  SuccessReceiptId: string
}

/**
 * Model TransactionsOutcomeExecutionOutcomeProof
 * 
 */
export type TransactionsOutcomeExecutionOutcomeProof = {
  direction: string
  hash: string
}

/**
 * Model TransactionsTransaction
 * 
 */
export type TransactionsTransaction = {
  actions: TransactionsTransactionActions[]
  hash: string
  nonce: bigint
  public_key: string
  receiver_id: string
  signature: string
  signer_id: string
}


/**
 * Model TransactionsTransactionActions
 * 
 */
export type TransactionsTransactionActions = {
  FunctionCall: TransactionsTransactionActionsFunctionCall
}

/**
 * Model TransactionsTransactionActionsFunctionCall
 * 
 */
export type TransactionsTransactionActionsFunctionCall = {
  args: string
  deposit: string
  gas: bigint
  method_name: string
}
