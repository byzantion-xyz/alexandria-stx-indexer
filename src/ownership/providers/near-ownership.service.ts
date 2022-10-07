import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
interface WalletNft {
  token_id: string
  contract_key: string
  owner_id: string
  token_series_id: string
}
import { wallets } from 'src/ownership/near-super-users';
import { resourceLimits } from 'worker_threads';

const PARAS_V2_API = 'https://api-v2-mainnet.paras.id';
const BATCH_LIMIT = 50;

@Injectable()
export class NearOwnershipService {
  private readonly logger = new Logger(NearOwnershipService.name);

  constructor(

  ) {}

  async process (): Promise<void> {
    const wallets = await this.fetchSuperUsersWallets();
    this.logger.log({ wallets });

    for (let wallet of wallets) {
      const walletNfts = await this.fetchWalletNfts(wallet);

      break;
    }

  }

  async fetchSuperUsersWallets(): Promise<string[]> {
    const owners = wallets.trim()
      .split('\n').map(i => i.trim())
      .reverse();

    return owners
  }

  async fetchWalletNfts(wallet: string): Promise<WalletNft[]> {
    try {
      this.logger.log(`fetchWalletNfts() ${wallet}`)
      let results: WalletNft[] = [];
      let query: AxiosRequestConfig = {
        params : {
          owner_id: wallet,
          __limit: 50,
          exclude_total_burn: true,
          __skip: 0
        }
      };

      let total = 0;

      do {
        this.logger.log(`Query PARAS API v2 `, { query });
        const { data, status } = await axios.get(`${PARAS_V2_API}/token`, query);
        total = data.data?.results?.length || 0;
        if (total < 1) break;
       
        let result = data.data.results.map(r => ({
          token_id: r.token_id,
          contract_key: r.contract_id,
          owner_id: r.owner_id,
          token_series_id: r.token_series_id
        }));
        results.push(...result);
        query.params.__skip += BATCH_LIMIT;

        this.logger.log({ result });
      } while (total === BATCH_LIMIT)

      return;
    } catch (err) {
      this.logger.warn(`fetchWalletNfts() failed for ${wallet}`);
      throw err;
    }
  }

  async processWallet(wallet: string): Promise<WalletNft[]> {
    // return differences
    return;
  }

  compareResult(walletNfts: WalletNft[], universalNfts: WalletNft[]): WalletNft[] {
    return;
  }

  reportResult(walletNfts: WalletNft[]): void {
    // log results
    return;
  }
}
