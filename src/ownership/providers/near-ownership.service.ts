import { Injectable, Logger } from '@nestjs/common';

import { wallets } from 'src/ownership/near-super-users';
import { InjectRepository } from '@nestjs/typeorm';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { Repository } from 'typeorm';
import { WalletNft, WalletNftsResult } from '../interfaces/wallet-nft.interface';
import { ContractConnectionService } from 'src/scrapers/near-scraper/providers/contract-connection-service';
import { SmartContract } from 'src/database/universal/entities/SmartContract';

const BATCH_LIMIT = 50;

@Injectable()
export class NearOwnershipService {
  private readonly logger = new Logger(NearOwnershipService.name);

  constructor(
    @InjectRepository(NftMeta)
    private nftMetaRepo: Repository<NftMeta>,
    @InjectRepository(SmartContract)
    private smartContractRepo: Repository<SmartContract>,
    private contractConnectionService: ContractConnectionService
  ) {}

  async process (): Promise<WalletNftsResult[]> {
    const wallets = await this.fetchSuperUsersWallets();
    const differences: WalletNftsResult[] = [];

    const contractKeys = await this.fetchNftContractKeys();

    for (let wallet of wallets) {
      let diff = await this.processWallet(wallet, contractKeys);
      differences.push(diff);
    }

    return differences;
  }

  async fetchNftContractKeys(): Promise<string[]> {
    const sql = `SELECT sc.contract_key FROM smart_contract sc ` + 
      `WHERE sc.chain_id = (select id from chain where symbol = 'Near') ` +
      `AND sc.type = Array['non_fungible_tokens']::"public"."SmartContractType"[]`;
    
    const scs = await this.smartContractRepo.query(sql);

    const contractKeys = scs.map(sc => sc.contract_key);

    return contractKeys;
  }

  async fetchSuperUsersWallets(): Promise<string[]> {
    const owners = wallets.trim()
      .split('\n').map(i => i.trim())
      .reverse();

    return owners
  }

  async fetchUniversalNfts(wallet: string): Promise<WalletNft[]> {
    const nftMetas = await this.nftMetaRepo.find({
      where: [{
        nft_state: { owner: wallet }
      }, {
        nft_state: { staked_owner: wallet, staked: true }
      }],
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

  async fetchSmartContractOwnedNfts (wallet: string, contractKey: string): Promise<WalletNft[]> {
    let results: WalletNft[] = [];
    try {
      this.logger.debug(`fetchSmartContactOwnedNfts() ${contractKey}`);

      const contract = await this.contractConnectionService.connectNftContract(contractKey);
      let limit = 50;
      let skip = 0;
      let nfts: any[] = [];
      do {
        nfts = await contract.nft_tokens_for_owner({ account_id: wallet, from_index: skip.toString(), limit });
        results.push(...nfts.map(nft => ({ token_id: nft.token_id, contract_key: contractKey }) ));
        skip += BATCH_LIMIT;
      } while (nfts.length === BATCH_LIMIT);
    } catch (err) {
      this.logger.warn(err);
    } finally {
      return results 
    }
  }

  async fetchWalletNfts(wallet: string, contractKeys: string[]): Promise<WalletNft[]> {
    try {
      this.logger.debug(`fetchWalletNfts() ${wallet}`)
      let results: WalletNft[] = [];

      for (const contractKey of contractKeys) {
        const nfts = await this.fetchSmartContractOwnedNfts(wallet, contractKey);
        results.push(...nfts);
      }
      this.logger.log({ results });
      return results;
    } catch (err) {
      this.logger.warn(`fetchWalletNfts() failed for ${wallet}`);
      throw err;
    }
  }

  async processWallet(wallet: string, contractKeys?: string[]): Promise<WalletNftsResult> {
    let differences: WalletNft[] = [];
    if (!contractKeys || !contractKeys.length) {
      contractKeys = await this.fetchNftContractKeys();
    }

    const walletNfts = await this.fetchWalletNfts(wallet, contractKeys);
    const universalNfts = await this.fetchUniversalNfts(wallet);

    // Symetrical diffrencen between both arrays after reoming missing metas.
    differences = await this.compareResult(walletNfts, universalNfts);

    if (differences && differences.length) {
      this.reportResult(wallet, differences);
    }

    return { 
      differences, 
      wallet 
    };
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
    this.logger.log({ owner: wallet, differences });
  }

}
