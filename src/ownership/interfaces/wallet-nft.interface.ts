export interface WalletNft {
  token_id: string
  contract_key: string
}

export interface WalletNftsResult {
  wallet: string,
  differences: WalletNft[]
}
