import { Injectable, Logger } from '@nestjs/common';

import { wallets } from 'src/ownership/near-super-users';
import { InjectRepository } from '@nestjs/typeorm';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { Repository } from 'typeorm';
import { WalletNft, WalletNftsResult } from '../interfaces/wallet-nft.interface';
import { ContractConnectionService } from 'src/scrapers/near-scraper/providers/contract-connection-service';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { NftState } from 'src/database/universal/entities/NftState';

const BATCH_LIMIT = 50;
const ASYNC_WALLETS = 10;
const ASYNC_SMART_CONTRACTS = 10;

@Injectable()
export class NearOwnershipService {
  private readonly logger = new Logger(NearOwnershipService.name);
  private nearConnection;
  private contractKeys: string[];

  constructor(
    @InjectRepository(NftMeta)
    private nftMetaRepo: Repository<NftMeta>,
    @InjectRepository(NftState)
    private nftStateRepo: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepo: Repository<SmartContract>,
    private contractConnectionService: ContractConnectionService
  ) {}

  async process (wallet?: string): Promise<WalletNftsResult[]> {
    const wallets = wallet ? [wallet] : await this.fetchSuperUsersWallets();
    const differences: WalletNftsResult[] = [];
    this.nearConnection = await this.contractConnectionService.connectNear();

    this.contractKeys = await this.fetchNftContractKeys();
    if (wallets.length > ASYNC_WALLETS) {
      this.contractKeys = await this.cleanNonNftContracts(wallets[0]);
    }

    let promisesBatch = [];

    for (let wallet of wallets) {
      promisesBatch.push(this.processWallet(wallet));

      if (promisesBatch.length % ASYNC_WALLETS === 0) {
        const result = await Promise.all(promisesBatch);
        differences.push(...result);
        promisesBatch = [];
      }
    }

    if (promisesBatch.length) {
      const result = await Promise.all(promisesBatch);
      differences.push(...result);
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
    return wallets.trim().split('\n').map(i => i.trim());
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

  async fetchSmartContractNftOwner(contractKey: string, token_id: string): Promise<string> {
    try {
      const contract = this.contractConnectionService.getContract(contractKey, this.nearConnection);
      const token = await contract.nft_token({ token_id: token_id }); 

      return token.owner_id;
    } catch (err) {
      this.logger.warn(err);
    }
  }

  async fetchSmartContractOwnedNfts (wallet: string, contractKey: string): Promise<WalletNft[]> {
    let results: WalletNft[] = [];

    try {
      //this.logger.debug(`fetchSmartContactOwnedNfts() ${contractKey}`);

      const contract = this.contractConnectionService.getContract(contractKey, this.nearConnection);

      let skip = 0;
      let nfts: any[] = [];
      do {
        nfts = await contract.nft_tokens_for_owner({ 
          account_id: wallet, 
          from_index: skip.toString(), 
          limit: BATCH_LIMIT 
        });
        results.push(...nfts.map(nft => ({ token_id: nft.token_id, contract_key: contractKey }) ));
        skip += BATCH_LIMIT;
      } while (nfts.length === BATCH_LIMIT);

    } catch (err) {
      if (err && err.error.indexOf('no tokens') < 0) {
        this.logger.warn(err);
      }
    } finally {
      return results 
    }
  }

  async fetchWalletNfts(wallet: string): Promise<WalletNft[]> {
    try {
      this.logger.debug(`fetchWalletNfts() ${wallet}`)
      let results: WalletNft[] = [];
      let contractKeys = this.contractKeys;

      let promisesBatch = [];

      for (let contractKey of contractKeys) {
        promisesBatch.push(this.fetchSmartContractOwnedNfts(wallet, contractKey));

        if (promisesBatch.length % ASYNC_SMART_CONTRACTS === 0) {
          const nfts = await Promise.all(promisesBatch) ;
          results.push(...nfts.flatMap(item => (item)));
          promisesBatch = [];
        }
      }

      if (promisesBatch.length) {
        const nfts = await Promise.all(promisesBatch) ;
        results.push(...nfts);
      }

      return results;
    } catch (err) {
      this.logger.warn(`fetchWalletNfts() failed for ${wallet}`);
      throw err;
    }
  }

  async testSmartContract(contractKey: string, wallet: string): Promise<string> {
    try {
      const contract = this.contractConnectionService.getContract(contractKey, this.nearConnection);
      //this.logger.debug(`Checking NFT smart contract ${contractKey}`);

      await contract.nft_tokens_for_owner(({ account_id: wallet, from_index: '0', limit: 1 }));
      return contractKey;
    } catch (err) {}
  }

  async cleanNonNftContracts (wallet: string): Promise<string[]> {
    let nftContractKeys = [];
    let promisesBatch = [];

    for (let contractKey of this.contractKeys) {
      promisesBatch.push(this.testSmartContract(contractKey, wallet));

      if (promisesBatch.length % ASYNC_SMART_CONTRACTS === 0) {
        let result = await Promise.all(promisesBatch);
        nftContractKeys.push(...result.filter(r => r));
        promisesBatch = [];
      }
    }

    if (promisesBatch.length) {
      let result = await Promise.all(promisesBatch);
      nftContractKeys.push(...result.filter(r => r));
    }

    return nftContractKeys;
  }

  async fixNftMetaOwner(token_id: string, contract_key: string, owner: string) {
    // find meta and upsert state owner
    const nftMeta = await this.nftMetaRepo.findOne({ where: {
      smart_contract: { contract_key },
      token_id: token_id
    }});

    // Upsert owner for nftMeta
    this.logger.log(`Setting correct owner: ${owner} for ${contract_key} ${token_id} ${nftMeta.id} `);
    await this.nftStateRepo.upsert({ meta_id: nftMeta.id, owner: owner }, ["meta_id"]);
  }

  async processWallet(wallet: string): Promise<WalletNftsResult> {
    this.logger.debug(`processWallet() ${wallet}`);
    let differences: WalletNft[] = [];

    const walletNfts = await this.fetchWalletNfts(wallet);
    const universalNfts = await this.fetchUniversalNfts(wallet);

    // Symetrical diffrencen between both arrays after reoming missing metas.
    differences = await this.compareResult(walletNfts, universalNfts);
    
    if (differences && differences.length) {
      this.reportResult(wallet, differences);
    }

    for (let diff of differences) {
      if (diff.contract_key !== 'x.paras.near') {
        let owner = await this.fetchSmartContractNftOwner(diff.contract_key, diff.token_id);
        if (owner) {
          await this.fixNftMetaOwner(diff.token_id, diff.contract_key, owner);
        }
      }
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
