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

  async scrape(data) {
    this.logger.debug('start scrape');
    const { contract_key } = data

    const { tokenMetas, nftContractMetadata } = await this.getContractAndTokenMetaData(contract_key);

    if (!tokenMetas) return {
      msg: `No tokens found for contract ${contract_key}`
    };

    await this.loadSmartContract(tokenMetas, nftContractMetadata)
    // await this.loadCollection(tokenMetas, nftContractMetadata)
  }

  async loadSmartContract(tokenMetas, nftContractMetadata) {
    this.logger.debug('loadSmartCollection');
  }

  async loadCollection(tokenMetas, nftContractMetadata) {
    this.logger.debug('loadCollection');

    // get first token meta for some collection table info
    const firstTokenMeta = tokenMetas[0]

    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.reference);
    const firstTokenIpfsImageUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.media)
    const { data: tokenIpfsMeta } = await axios.get(firstTokenIpfsUrl);

    // // Look to see if collection exists
    // let byzCollection = await Collection.findOne({ contract_key });
 
    let byzCollection = this.prismaService.collection.findUnique({
      where: { contract_key: contract_key }
    });

    if (byzCollection) {
      console.log(`[scraping ${asset_name}] Existing Collection found: `, byzCollection.contract_key);
    }

    if (!byzCollection) {
      byzCollection = this.prismaService.collection.create({
        data: {
          asset_name,
          collection_size: Number(collectionSize),
          description: firstTokenMeta?.metadata?.description || tokenIpfsMeta?.description || "",
          cover_image: firstTokenIpfsImageUrl,
          title: nftContractMetadata.name,
        }
      });
    }
    return byzCollection
  }

  async loadNftMetasFromChain(tokenMetas, nftContractMetadata, byzCollection) {
    for (let i = 0; i < tokenMetas.length; i++) {
      // Check if meta already exists
      const meta = await Meta.findOne({ contract_key, token_id: i + 1 });
      if (!meta) {
        // Create the Meta Model and queue it for insertMany
        const mediaUrl = getTokenIpfsMediaUrl(nftContractMetadata.base_uri, tokenMetas[i].metadata.media)
  
        const byzMeta = new Meta({
          collection_id: byzCollection._id,
          contract_key,
          name: tokenMetas[i].metadata.title,
          image: mediaUrl,
          token_id: i,
          rarity: 0,
          minted: false,
          attributes: [
            {
              trait_type: byzCollection.artist,
              value: byzCollection.asset_name
            }
          ],
          slug
        });
  
        // process attributes
        let attributes = []
        if (contract_key == "misfits.tenk.near") {
          const tokenIpfsUrl = getTokenIpfsUrl(nftContractMetadata.base_uri, tokenMetas[i].metadata.reference);
          let { data: tokenIpfsMeta } = await axios.get(tokenIpfsUrl);
          for (const property in tokenIpfsMeta) {
            const newAttribute = {
              trait_type: property,
              value: tokenIpfsMeta[property]
            }
            attributes.push(newAttribute)
          }
        } else if (contract_key == "nearnautnft.near") {
          let attributesObject = JSON.parse(tokenMetas[i].metadata.extra)
          for (const property in attributesObject) {
            const splitProperty = property.split('_')
            if (splitProperty[0] != "attributes") continue
            const newAttribute = {
              trait_type: splitProperty[1].charAt(0).toUpperCase() + splitProperty[1].slice(1),
              value: attributesObject[property]
            }
            attributes.push(newAttribute)
          }
        } else if (contract_key == "engineart.near") {
          attributes = JSON.parse(tokenMetas[i].metadata.extra)
        } else {
          const tokenIpfsUrl = getTokenIpfsUrl(nftContractMetadata.base_uri, tokenMetas[i].metadata.reference);
          let { data: tokenIpfsMeta } = await axios.get(tokenIpfsUrl);
          attributes = tokenIpfsMeta.attributes;
        }
  
        // Check whether the tokenIpfsMeta has attributes using the following criteria:
        // If attributes exists, if attibutes is an array, if attributes has 1 or more items
        // Otherwise stick with the default
        if (attributes && Array.isArray(attributes) && attributes.length > 0) {
          byzMeta.attributes = attributes;
        }
        metaInsertBatch.push(byzMeta);
      }
      if (i % 100 === 0) console.log(`[scraping ${asset_name}] Metas processed: ${i} of ${collectionSize}`);
    };
      
    // Perform a batch insert of the Metas into the database
    await Meta.insertMany(metaInsertBatch);
    console.log(`[scraping ${asset_name}] Meta batch inserted`, metaInsertBatch.length);
  
    // Update Rarity
    // Gets the collection with all metas, sets rarity and score values
    // on attributes as well as rarity and ranking on the meta
    await exports.updateRarity(byzCollection._id, asset_name);
  
    // Insert Attributes record
    // Adds a record to the attributes collection for use by the
    // filter function on website (grab the information from the database)
    await exports.createAttributes(contract_key, asset_name);
  
    // Rebuild UI if required. The default is true.
    if (rebuild_ui) {
      axios.get('https://api.vercel.com/v1/integrations/deploy/prj_s08WFRxHAEJPiBEMfck6L7TWeAcA/61XRF0FryQ');
    }
  
    return {
      contract_key,
      collection_id: byzCollection._id,
      metas_loaded: metaInsertBatch.length
    };
  }

  async getContractAndTokenMetaData(contract_key) {
    const near = await connect(nearConfig);
    const account = await near.account(nearAccountId);
    const contract = await this.getContract(contract_key, account)
    const collectionSize = await contract.nft_total_supply();

    //let nftTokensBatchSize = collectionSize
    let nftTokensBatchSize = 1 // batch size limit for nft_tokens() to avoid exceeded gas limit per call

    let tokenMetas = []
    for (let i = 0; i < 2; i += nftTokensBatchSize) {
    const currentTokenMetasBatch = await contract.nft_tokens({from_index: Number(0).toString(), limit: nftTokensBatchSize});
      tokenMetas = tokenMetas.concat(currentTokenMetasBatch);
    }

    const nftContractMetadata = await contract.nft_metadata();

    return {
      tokenMetas,
      nftContractMetadata
    }
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
