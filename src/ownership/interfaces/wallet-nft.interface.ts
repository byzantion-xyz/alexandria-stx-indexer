export interface WalletNft {
  token_id: string
  contract_key: string
  universal_owner?: string
  smart_contract_owner?: string
}

export interface WalletNftsResult {
  wallet: string,
  differences: WalletNft[]
}
