import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as axios from 'axios';
interface WalletNft {
  token_id: string
}
import { wallets } from 'src/ownership/near-super-users';

const PARAS_V2_API = 'https://api-v2-mainnet.paras.id';

@Injectable()
export class NearOwnershipService {
  private readonly logger = new Logger(NearOwnershipService.name);

  constructor(

  ) {}

  async process (): Promise<void> {
    const wallets = await this.fetchSuperUsersWallets();

    for (let wallet of wallets) {
      const walletNfts = this.fetchWalletNfts(wallet);
    }

  }

  async fetchSuperUsersWallets(): Promise<string[]> {
    const owners = wallets.trim().split('\n');
    return owners
  }

  async fetchWalletNfts(wallet: string): Promise<WalletNft[]> {
    try {



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
