import { Injectable, Logger } from '@nestjs/common';

import { wallets } from 'src/ownership/near-super-users';
import { InjectRepository } from '@nestjs/typeorm';
import { NftMeta } from 'src/database/universal/entities/NftMeta';
import { Repository } from 'typeorm';
import { WalletNft } from '../interfaces/wallet-nft.interface';
import { ContractConnectionService } from 'src/scrapers/near-scraper/providers/contract-connection-service';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { NftState } from 'src/database/universal/entities/NftState';
import { Action } from 'src/database/universal/entities/Action';
import { ActionName } from 'src/indexers/common/helpers/indexer-enums';

const BATCH_LIMIT = 50;
const ASYNC_WALLETS = 10;
const ASYNC_SMART_CONTRACTS = 10;

@Injectable()
export class NearOwnershipService {
  private readonly logger = new Logger(NearOwnershipService.name);
  private nearConnection;
  private contractKeys: string[];
  private recentTransfer: Action;

  constructor(
    @InjectRepository(NftMeta)
    private nftMetaRepo: Repository<NftMeta>,
    @InjectRepository(Action)
    private actionRepo: Repository<Action>,
    @InjectRepository(NftState)
    private nftStateRepo: Repository<NftState>,
    @InjectRepository(SmartContract)
    private smartContractRepo: Repository<SmartContract>,
    private contractConnectionService: ContractConnectionService
  ) {}

  async process (wallets?: string[]): Promise<WalletNft[]> {
    if (!wallets || !wallets.length) {
      wallets = await this.fetchSuperUsersWallets();
    }

    const differences: WalletNft[] = [];
    this.nearConnection = await this.contractConnectionService.connectNear();

    this.contractKeys = await this.fetchNftContractKeys();
    if (wallets.length > ASYNC_WALLETS) {
      this.contractKeys = await this.cleanNonNftContracts(wallets[0]);
    }

    this.recentTransfer = await this.actionRepo.findOneOrFail({ 
      where: { action: ActionName.transfer },
      order: { block_height: "DESC", id: "DESC" }
    });

    let promisesBatch = [];

    for (let wallet of wallets) {
      promisesBatch.push(this.processWallet(wallet));

      if (promisesBatch.length % ASYNC_WALLETS === 0) {
        const result = await Promise.all(promisesBatch);
        differences.push(...result.filter(r => r.length));
        promisesBatch = [];
      }
    }

    if (promisesBatch.length) {
      const result = await Promise.all(promisesBatch);
      differences.push(...result.filter(r => r.length));
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
      where: {
        nft_state: { owner: wallet }
      },
      relations: {
        smart_contract: true,
        nft_state: true
      },
      select: {
        token_id: true,
        nft_state: { owner: true, owner_tx_id: true, owner_block_height: true },
        smart_contract: { contract_key: true }
      }
    });

    return nftMetas.map(i => ({
      token_id: i.token_id,
      contract_key: i.smart_contract.contract_key,
      universal_owner: i.nft_state?.owner
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
        results.push(...nfts.map(nft => ({ token_id: nft.token_id, contract_key: contractKey, smart_contract_owner: wallet }) ));
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
    const nftMeta = await this.nftMetaRepo.findOne({ 
      where: { smart_contract: { contract_key }, token_id: token_id },
      relations: { nft_state: true }
    });
    let actualOwner = nftMeta.nft_state?.owner;

    let actionId: string;
    try {
      const newAction = this.actionRepo.create({
        block_height: this.recentTransfer.block_height,
        block_time: this.recentTransfer.block_time,
        tx_id: '0', // Non nullable
        action: ActionName.reset_owner,
        ...(actualOwner && { seller: actualOwner }),
        buyer: owner,
        nft_meta_id: nftMeta.id,
        collection_id: nftMeta.collection_id,
        smart_contract_id: nftMeta.smart_contract_id
      });

      const saved = await this.actionRepo.save(newAction);
      actionId = saved.id;

      await this.nftStateRepo.upsert({ meta_id: nftMeta.id, owner: owner }, ["meta_id"]);
      this.logger.log(`Fixed owner ${actualOwner || ''} --> ${owner} for ${contract_key} ${token_id}`);
    } catch (err) {
      if (actionId) {
        // Delete action when upsert fails to maintain data consistency
        await this.actionRepo.delete({ id: actionId });
      }
      throw err;
    }
  }

  async processWallet(wallet: string): Promise<WalletNft[]> {
    this.logger.debug(`processWallet() ${wallet}`);
    let differences: WalletNft[] = [];

    const walletNfts = await this.fetchWalletNfts(wallet);
    const universalNfts = await this.fetchUniversalNfts(wallet);

    // Symetrical diffrencen between both arrays after reoming missing metas.
    differences = await this.compareResult(walletNfts, universalNfts);
    if (differences && differences.length) {
      this.reportResult(wallet, differences);
    }

    let result: WalletNft[] = [];
    for (let diff of differences) {
      let owner = diff.smart_contract_owner;
      if (!owner) {
        owner = await this.fetchSmartContractNftOwner(diff.contract_key, diff.token_id);
      }
      if (owner) {
        await this.fixNftMetaOwner(diff.token_id, diff.contract_key, owner);
      }
      result.push({
        token_id: diff.token_id,
        contract_key: diff.contract_key,
        universal_owner: diff.universal_owner,
        smart_contract_owner: owner
      });
    }

    return result;
  }

  async compareResult(walletNfts: WalletNft[], universalNfts: WalletNft[]): Promise<WalletNft[]> {
    const differences = this.getSimetricalDifference(walletNfts, universalNfts);

    // Return differences only for existing metas
    if (differences && differences.length) {
      let nftMetas = await this.nftMetaRepo.find({ 
        where: differences.map(diff => ({ token_id: diff.token_id, smart_contract: { contract_key: diff.contract_key }})),
        relations: { smart_contract: true, nft_state: true },
        select: {
          token_id: true,
          nft_state: { owner: true },
          smart_contract: { contract_key: true }
        }
      });

      return nftMetas.map(i => ({
        token_id: i.token_id,
        contract_key: i.smart_contract.contract_key,
        universal_owner: i.nft_state?.owner
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

  async getActiveWallets(chainSymbol: string, total = 5000): Promise<string[]> {
    const rows: Action[] = await this.actionRepo.query(`
      SELECT seller from action 
      WHERE action in ('list', 'unlist', 'accept-bid')
      AND block_time > current_date - (interval '3 months')
      and seller is not null
      AND smart_contract_id in 
        (select id from smart_contract sc where sc.chain_id = (select id from chain where symbol = '${chainSymbol}'))
      GROUP BY seller HAVING count(*) > 0 order by count(*) desc limit ${total}`);

    const wallets = rows.map(r => r.seller);
    return wallets;
  }

}