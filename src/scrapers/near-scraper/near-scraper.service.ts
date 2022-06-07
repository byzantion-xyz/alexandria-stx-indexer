import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SmartContractType } from '@prisma/client'
const axios = require('axios').default;
const nearAPI = require("near-api-js");
import { v4 as uuidv4 } from 'uuid';

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

const NEAR_PROTOCOL_DB_ID = "174c3df6-0221-4ca7-b966-79ac8d981bdb"


@Injectable()
export class NearScraperService {
  private readonly logger = new Logger(NearScraperService.name);

  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  async scrape(data) {
    this.logger.debug('start scrape');
    const { contract_key } = data

    const { tokenMetas, nftContractMetadata, collectionSize } = await this.getContractAndTokenMetaData(contract_key);

    if (!tokenMetas) return {
      msg: `No tokens found for contract ${contract_key}`
    };

    const smartContract = await this.loadSmartContract(nftContractMetadata, contract_key);
    const byzCollection = await this.loadCollection(tokenMetas, nftContractMetadata, contract_key, collectionSize)
    const nftMetas = await this.loadNftMetas(tokenMetas, nftContractMetadata, smartContract, byzCollection, contract_key);
    console.log("nftMetas", nftMetas);
    return "Success"
  }

  async loadSmartContract(nftContractMetadata, contract_key) {
    this.logger.debug('loadSmartContract');
    const createSmartCollection = await this.prismaService.smartContract.create({
      data: {
        contract_key: contract_key,
        name: nftContractMetadata.name,
        type: SmartContractType.non_fungible_tokens,
        asset_name: contract_key,
        chain: {
          connect: {
            id: NEAR_PROTOCOL_DB_ID,
          },
        },
      },
    })
    return createSmartCollection
  }

  async loadCollection(tokenMetas, nftContractMetadata, contract_key, collectionSize) {
    this.logger.debug('loadCollection');

    // get first token data for the collection record data
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.reference);
    const firstTokenIpfsImageUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.media)
    const { data: tokenIpfsMeta } = await axios.get(firstTokenIpfsUrl);

    // // Look to see if collection exists
    // let byzCollection = this.prismaService.collection.findUnique({
    //   where: { contract_key: contract_key }
    // });
    let byzCollection = null

    if (byzCollection) {
      this.logger.debug(`[scraping ${contract_key}] Existing Collection found: `, byzCollection.contract_key);
    }

    if (!byzCollection) {
      byzCollection = await this.prismaService.collection.create({
        data: {
          collection_size: Number(collectionSize),
          description: firstTokenMeta?.metadata?.description || tokenIpfsMeta?.description || "",
          cover_image: firstTokenIpfsImageUrl,
          title: nftContractMetadata.name,
        }
      });
    }
    return byzCollection
  }

  async loadNftMetas(tokenMetas, nftContractMetadata, smartContract, byzCollection, contract_key) {
    let nftMetaInsertBatch = []
    for (let i = 0; i < tokenMetas.length; i++) {

      const nftMeta = await this.prismaService.nftMeta.findFirst({
        where: {
          smart_contract_id: smartContract.id,
          token_id: Number(i)
        },
      })

      const nftMetaId = uuidv4();

      const attributes = await this.getNftMetaAttributes(nftContractMetadata, tokenMetas[i], contract_key, byzCollection, nftMetaId);
      console.log("attributes")
      console.log("")
      console.log("")
      console.log(attributes)

      if (!nftMeta) {
        const mediaUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, tokenMetas[i].metadata.media)
        nftMetaInsertBatch.push({
          id: nftMetaId,
          collection_id: byzCollection.id,
          smart_contract_id: smartContract.id,
          chain_id: NEAR_PROTOCOL_DB_ID,
          name: tokenMetas[i].metadata.title,
          image: mediaUrl,
          token_id: i + 1,
          rarity: 0,
          ranking: 0,
          attributes: {
            create: {
              data: attributes
            }
          }
        });
      }

      if (i % 100 === 0) this.logger.debug(`[scraping ${contract_key}] Metas processed: ${i} of ${byzCollection.collection_size}`);
    };

    // Perform a batch insert of the NftMetas into the database
    const nftMetas = await this.prismaService.nftMeta.createMany({
      data: nftMetaInsertBatch
    })
    this.logger.debug(`[scraping ${contract_key}] Meta batch inserted`, nftMetaInsertBatch.length);

    return nftMetas
  }

  // async asdf(tokenMetas, nftContractMetadata, smartContract, byzCollection, contract_key) {
  //   // Update Rarity
  //   // Gets the collection with all metas, sets rarity and score values
  //   // on attributes as well as rarity and ranking on the meta
  //   await exports.updateRarity(byzCollection._id, asset_name);

 
  
  //   // Insert Attributes record
  //   // Adds a record to the attributes collection for use by the
  //   // filter function on website (grab the information from the database)
  //   await exports.createAttributes(contract_key, asset_name);
  
  //   // Rebuild UI if required. The default is true.
  //   if (rebuild_ui) {
  //     axios.get('https://api.vercel.com/v1/integrations/deploy/prj_s08WFRxHAEJPiBEMfck6L7TWeAcA/61XRF0FryQ');
  //   }
  
  //   return {
  //     contract_key,
  //     collection_id: byzCollection._id,
  //     metas_loaded: metaInsertBatch.length
  //   };
  // }

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
      nftContractMetadata,
      collectionSize
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

  async getNftMetaAttributes(nftContractMetadata, tokenMeta, contract_key, byzCollection, nftMetaId) {
    let attributes = []
    if (contract_key == "misfits.tenk.near") {
      const tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, tokenMeta.metadata.reference);
      let { data: tokenIpfsMeta } = await axios.get(tokenIpfsUrl);
      for (const property in tokenIpfsMeta) {
        const newAttribute = {
          trait_type: property,
          value: tokenIpfsMeta[property]
        }
        attributes.push(newAttribute)
      }
    } 
    else if (contract_key == "nearnautnft.near") {
      let attributesObject = JSON.parse(tokenMeta.metadata.extra)
      for (const property in attributesObject) {
        const splitProperty = property.split('_')
        if (splitProperty[0] != "attributes") continue
        const newAttribute = {
          trait_type: splitProperty[1].charAt(0).toUpperCase() + splitProperty[1].slice(1),
          value: attributesObject[property]
        }
        attributes.push(newAttribute)
      }
    } 
    else if (contract_key == "engineart.near") {
      attributes = JSON.parse(tokenMeta.metadata.extra)
    } 
    else {
      const tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, tokenMeta.metadata.reference);
      let { data: tokenIpfsMeta } = await axios.get(tokenIpfsUrl);
      attributes = tokenIpfsMeta.attributes;
    }

    if (!attributes) {
      attributes = [
        {
          trait_type: byzCollection.contract_key,
          value: byzCollection.title
        }
      ]
    }

    const attributesWithIDs = attributes.map((attr) => {
      return {
        ...attr,
        meta_id: nftMetaId,
        sequence: "1"
      }
    })

    console.log("attributesWithIDs", attributesWithIDs)

    const nftMetaAttributes = await this.prismaService.nftMetaAttribute.createMany({
      data: attributesWithIDs
    })
    return nftMetaAttributes
  }
}
