import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
const axios = require('axios').default;
const nearAPI = require("near-api-js");

const { keyStores, connect } = nearAPI;
const homedir = require("os").homedir();
const CREDENTIALS_DIR = ".near-credentials";
const credentialsPath = require("path").join(homedir, CREDENTIALS_DIR);
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(credentialsPath);

const nearAccountId = "9936890d36d4dc77414e685f7ac667fc7b67d16a0cf8dae8a9c46f0976635ecf"

const nearConfig = {
  networkId: "mainnet",
  keyStore,
  nodeUrl: "https://rpc.mainnet.near.org",
  walletUrl: "https://wallet.mainnet.near.org",
  helperUrl: "https://helper.mainnet.near.org",
  explorerUrl: "https://explorer.mainnet.near.org",
};

@Injectable()
export class NearScraperService {
  private readonly logger = new Logger(NearScraperService.name);

  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  async loadCollectionFromChain(data) {
    this.logger.debug('loadCollectionFromChain');
    const { contract_key, asset_name, artist, slug, external_url } = data

    // // Look to see if collection exists
    // let byzCollection = await Collection.findOne({ contract_key });
    // if (byzCollection) {
    //   console.log(`[scraping ${asset_name}] Existing Collection found: `, byzCollection.contract_key);
    // }
    let byzCollection = this.prismaService.collection.findUnique({
      where: { contract_key: contract_key }
    });

    const near = await connect(nearConfig);
    const account = await near.account(nearAccountId);
    const contract = await this.getContract(contract_key, account)
    const collectionSize = await contract.nft_total_supply();

    let nftTokensBatchSize = 1 // batch size limit for nft_tokens() to avoid exceeded gas limit per call

    let tokenMetas = []
    for (let i = 0; i < 2; i += nftTokensBatchSize) {
    const currentTokenMetasBatch = await contract.nft_tokens({from_index: Number(0).toString(), limit: nftTokensBatchSize});
      tokenMetas = tokenMetas.concat(currentTokenMetasBatch);
    }
  
    if (!tokenMetas) return {
      msg: `No tokens found for contract ${contract_key}`
    };

    // get first token meta for some collection table info
    const firstTokenMeta = tokenMetas[0]
    const nftContractMetadata = await contract.nft_metadata();

    let tokenIpfsMeta, firstTokenIpfsImageUrl
    if (contract_key != "nearnautnft.near") {
      const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.reference);
      firstTokenIpfsImageUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.media)
      const { data } = await axios.get(firstTokenIpfsUrl);
      tokenIpfsMeta = data
    }

    if (!byzCollection) {
      byzCollection = this.prismaService.collection.create({
        data: {
          asset_name,
          collection_size: Number(collectionSize),
          description: firstTokenMeta?.metadata?.description || tokenIpfsMeta?.description || "",
          external_url,
          cover_image: firstTokenIpfsImageUrl,
          title: nftContractMetadata.name,
        }
      });
    }
    return byzCollection
  }

  async getContract(contract_key, account) {
    return new nearAPI.Contract(
      account, // the account object that is connecting
      contract_key, // name of contract you're connecting to
      {
        viewMethods: ["nft_metadata", "nft_token", "nft_total_supply", "nft_tokens"], // view methods do not change state but usually return a value
        sender: account, // account object to initialize and sign transactions.
      }
    );
  }

  getTokenIpfsUrl(base_uri, reference) {
    if (reference.includes("https")) return reference
    return `${base_uri}/${reference}`
  };
  
  getTokenIpfsMediaUrl(base_uri, media) {
    if (media.includes("https")) return media
    return `${base_uri}/${media}`
  };
}
