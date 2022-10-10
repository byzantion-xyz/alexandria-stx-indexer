import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import { wallets } from 'src/ownership/near-super-users';
import { InjectRepository } from '@nestjs/typeorm';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { Repository } from 'typeorm';
import { WalletNft } from '../interfaces/wallet-nft.interface';

const PARAS_V2_API = 'https://api-v2-mainnet.paras.id';
const BATCH_LIMIT = 50;

@Injectable()
export class NearOwnershipService {
  private readonly logger = new Logger(NearOwnershipService.name);

  constructor(
    @InjectRepository(NftMeta)
    private nftMetaRepo: Repository<NftMeta>,
  ) {}

  async process (): Promise<void> {
    const wallets = await this.fetchSuperUsersWallets();

    for (let wallet of wallets) {
      await this.processWallet(wallet);
    }
  }

  async fetchSuperUsersWallets(): Promise<string[]> {
    const owners = wallets.trim()
      .split('\n').map(i => i.trim())
      .reverse();

    return owners
  }

  async fetchUniversalNfts(wallet: string): Promise<WalletNft[]> {
    const nftMetas = await this.nftMetaRepo.find({
      where: {
        nft_state: { owner: wallet }
      },
      relations: {
        smart_contract: true
      },
      select: {
        token_id: true,
        smart_contract: { contract_key: true }
      }
    });

    return nftMetas.map(i => ({
      token_id: i.token_id,
      contract_key: i.smart_contract.contract_key,
    }));
  }

  async fetchWalletNfts(wallet: string): Promise<WalletNft[]> {
    try {
      this.logger.debug(`fetchWalletNfts() ${wallet}`)
      let results: WalletNft[] = [];
      let query: AxiosRequestConfig = {
        timeout: 10000,
        params : {
          owner_id: wallet,
          __limit: 50,
          exclude_total_burn: true,
          __skip: 0
        }
      };

      let total = 0;

      do {
        this.logger.debug(`fetchWalletNfts() Query PARAS API limit=${query.params.__limit} skip=${query.params.__skip} `);
        const { data, status } = await axios.get(`${PARAS_V2_API}/token`, query);
        total = data.data?.results?.length || 0;
        if (total < 1) break;
       
        let result = data.data.results.map(r => ({
          token_id: r.token_id,
          contract_key: r.contract_id
        }));
        results.push(...result);
        query.params.__skip += BATCH_LIMIT;

      } while (total === BATCH_LIMIT);

      return results;
    } catch (err) {
      this.logger.warn(`fetchWalletNfts() failed for ${wallet}`);
      throw err;
    }
  }

  async processWallet(wallet: string): Promise<WalletNft[]> {
    let differences: WalletNft[] = [];

    const walletNfts = await this.fetchWalletNfts(wallet);
     
    const universalNfts = await this.fetchUniversalNfts(wallet);
    
    // Symetrical diffrencen between both arrays after reoming missing metas.
    differences = await this.compareResult(walletNfts, universalNfts);

    if (differences && differences.length) {
      this.reportResult(wallet, differences);
    }

    return differences;
  }

  async compareResult(walletNfts: WalletNft[], universalNfts: WalletNft[]): Promise<WalletNft[]> {
    const differences = this.getSimetricalDifference(walletNfts, universalNfts);

    // Return differences only for existing metas
    if (differences && differences.length) {
      let nftMetas = await this.nftMetaRepo.find({ 
        where: differences.map(diff => ({ token_id: diff.token_id, smart_contract: { contract_key: diff.contract_key }})),
        relations: { smart_contract: true },
        select: {
          token_id: true,
          smart_contract: { contract_key: true }
        }
      });

      this.logger.debug({ nftMetas });

      return nftMetas.map(i => ({
        token_id: i.token_id,
        contract_key: i.smart_contract.contract_key,
      }));
    } else {
      return [];
    }
  }

  getSimetricalDifference(walletNfts: WalletNft[], universalNfts: WalletNft[]): WalletNft[] {
    return walletNfts.filter(a =>
      !universalNfts.some(b=> a.contract_key == b.contract_key && a.token_id == b.token_id)
    );
  }

  reportResult(wallet: string, differences: WalletNft[]): void {
    this.logger.log(`${differences.length} NFT differences found for owner: ${wallet}`);
    this.logger.log({ differences });
  }
}
