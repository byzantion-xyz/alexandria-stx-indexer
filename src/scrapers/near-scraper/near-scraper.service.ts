import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmartContractType } from '@prisma/client'
import { IpfsHelperService } from '../providers/ipfs-helper.service';
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

const NEAR_PROTOCOL_DB_ID = "174c3df6-0221-4ca7-b966-79ac8d981bdb"

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class NearScraperService {
  private readonly logger = new Logger(NearScraperService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ipfsHelperService: IpfsHelperService
  ) {}

  async scrape(data) {
    this.logger.log('start scrape');
    const { contract_key } = data

    const { tokenMetas, nftContractMetadata, collectionSize } = await this.getContractAndTokenMetaData(contract_key);

    if (!tokenMetas)
      this.logger.error(`No tokens found for contract ${contract_key}`)

    await this.pin(tokenMetas, nftContractMetadata, contract_key);
    const smartContract = await this.loadSmartContract(nftContractMetadata, contract_key);
    const collection = await this.loadCollection(tokenMetas, nftContractMetadata, contract_key, collectionSize);
    const numNftMetasLoaded = await this.loadNftMetasAndTheirAttributes(tokenMetas, nftContractMetadata, smartContract.id, contract_key, collection);
    if (numNftMetasLoaded > 0) {
      await this.updateRarities(smartContract, contract_key);
      await this.loadCollectionAttributes(collection.id, contract_key);
    }
    this.logger.log('SCRAPING COMPLETE');
    return "Success"
  }

  async pin(tokenMetas, nftContractMetadata, contract_key) {
    this.logger.log('pin');
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.reference);
    if (!firstTokenIpfsUrl.includes('ipfs')) return // if the metadata is not stored on ipfs return

    const pinDataResult = await this.ipfsHelperService.pinIpfsFolder(firstTokenIpfsUrl, `${contract_key}`);
    if (pinDataResult.pin_status === 'pinning') {
      this.logger.log('IPFS pinning in progress');
    } else {
      this.logger.log('Pinning complete');
    }
  };

  async loadSmartContract(nftContractMetadata, contract_key) {
    this.logger.log('loadSmartContract');
    const smartContract = await this.prismaService.smartContract.upsert({
      where: {
        contract_key: contract_key
      },
      update: {},
      create: {
        contract_key: contract_key,
        spec: nftContractMetadata.spec,
        name: nftContractMetadata.name,
        type: SmartContractType.non_fungible_tokens,
        asset_name: contract_key,
        chain: {
          connect: {
            id: NEAR_PROTOCOL_DB_ID,
          },
        },
        json_meta: {
          "chain_meta": nftContractMetadata
        }
      },
      select: {
        id: true,
        frozen: true
      }
    })
    return smartContract
  }

  async loadCollection(tokenMetas, nftContractMetadata, contract_key, collectionSize) {
    this.logger.log('loadCollection');

    // get first token data for the collection record data
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.reference);
    const firstTokenIpfsImageUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.media)
    const { data: tokenIpfsMeta } = await axios.get(firstTokenIpfsUrl);

    const byzCollection = await this.prismaService.collection.upsert({
      where: {
        slug: contract_key
      },
      update: {},
      create: {
        collection_size: Number(collectionSize),
        description: firstTokenMeta?.metadata?.description || tokenIpfsMeta?.description || "",
        cover_image: this.ipfsHelperService.getByzIpfsUrl(firstTokenIpfsImageUrl),
        title: nftContractMetadata.name,
        slug: contract_key
      }
    });
    return byzCollection
  }

  async loadNftMetasAndTheirAttributes(tokenMetas, nftContractMetadata, smartContractId, contract_key, collection) {
    let nftMetaPromises = []
    for (let i = 0; i < tokenMetas.length; i++) {
      const nftMeta = await this.prismaService.nftMeta.findFirst({
        where: {
          smart_contract_id: smartContractId,
          token_id: tokenMetas[i].token_id
        },
      })

      if (!nftMeta) {

        const tokenIpfsMeta = await this.getTokenIpfsMeta(nftContractMetadata, tokenMetas[i]);

        let mediaUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, tokenMetas[i].metadata.media)
        if (mediaUrl && mediaUrl != "" && mediaUrl.includes('ipfs')) {
          mediaUrl = this.ipfsHelperService.getByzIpfsUrl(mediaUrl);
        }

        const attributes = await this.getNftMetaAttributes(nftContractMetadata, tokenMetas[i], contract_key);

        const nftMeta = this.prismaService.nftMeta.create({
          data: {
            smart_contract_id: smartContractId,
            chain_id: NEAR_PROTOCOL_DB_ID,
            collection_id: collection.id,
            name: tokenMetas[i].metadata.title,
            image: mediaUrl,
            token_id: tokenMetas[i].token_id,
            rarity: 0,
            ranking: 0,
            attributes: {
              createMany: {
                data: attributes
              },
            },
            json_meta: {
              "chain_meta": tokenMetas[i],
              "ipfs_meta": tokenIpfsMeta
            }
          },
        })
        nftMetaPromises.push(nftMeta)

        if (i % 100 === 0) {
          await Promise.all(nftMetaPromises)
          nftMetaPromises = []
          this.logger.log(`[scraping ${contract_key}] NftMetas processed: ${i} of ${collection.collection_size}`);
        } 
      }
    };
    await Promise.all(nftMetaPromises)
    this.logger.log(`[scraping ${contract_key}] NftMetas Processing COMPLETE`);
    return nftMetaPromises.length
  }

  async updateRarities(smartContract, contract_key, override_frozen = false) {
    this.logger.log(`[scraping ${contract_key}] Running updateRarity()`);
  
    if (smartContract.frozen && !override_frozen) {
      const msg = `[scraping ${contract_key}] Collection is frozen, rarity update abandoned`;
      this.logger.log(msg);
      return msg;
    }

    let nftMetas = []
    nftMetas = await this.prismaService.nftMeta.findMany({
      where: {
        smart_contract_id: smartContract.id
      },
      include: {
        attributes: true
      }
    })
  
    this.logger.log(`[scraping ${contract_key}] Adding Trait Counts`);
    for (let nftMeta of nftMetas) {
      let hasTraitCount = false;
      for (let attr of nftMeta.attributes) {
        if (attr.trait_type == 'Trait Count') {
          hasTraitCount = true;
        }
      }

      if (!hasTraitCount) {
        let attribute_count = 0;
        for (let attr of nftMeta.attributes) {
          if (attr.value != 'None' && attr.value != 'none' && attr.value != null) {
            attribute_count++;
          }
        }

        nftMeta.attributes.push({
          trait_type: 'Trait Count',
          value: attribute_count.toString()
        })
      }
    }

    this.logger.log(`[scraping ${contract_key}] Updating NftMetaAttribute Rarity Scores...`);
    let obj = {};
    for (let nftMeta of nftMetas) {
      for (let attr of nftMeta.attributes) {
        obj[attr.trait_type] = {};
      }
    }
    for (let nftMeta of nftMetas) {
      for (let attr of nftMeta.attributes) {
        obj[attr.trait_type][attr.value] = 0;
      }
    }
    for (let nftMeta of nftMetas) {
      for (let attr of nftMeta.attributes) {
        obj[attr.trait_type][attr.value]++;
      }
    }

    this.logger.log(`[scraping ${contract_key}] Updating NftMetaAttribute Rarity Scores to %`);
    for (let nftMeta of nftMetas) {
      for (let attr of nftMeta.attributes) {
        attr.rarity = obj[attr.trait_type][attr.value];
      }
    }
    for (let nftMeta of nftMetas) {
      for (let attr of nftMeta.attributes) {
        attr.rarity = attr.rarity / nftMetas.length;
        attr.score = 1 / attr.rarity;
      }
    }

    this.logger.log(`[scraping ${contract_key}] Updating NftMeta Rarities`);
    for (let nftMeta of nftMetas) {
      let rarity_score = 0;
      for (let attr of nftMeta.attributes) {
        rarity_score += 1 / attr.rarity;
      }
      nftMeta.rarity = rarity_score;
    }
    nftMetas.sort((a, b) => {
      return b.rarity - a.rarity;
    });

    let updatedNftMetaPromises = [];
    let count = 0;
    for (let nftMeta of nftMetas) {
      const updatedNftMeta = await this.prismaService.nftMeta.update({
        where: {
          id: nftMeta.id
        },
        data: {
          rarity: nftMeta.rarity,
          ranking: (Number(count) + 1),
          attributes: {
            deleteMany: {},
            create: nftMeta.attributes.map((attr) => {
              return {
                trait_type: attr.trait_type,
                value: attr.value,
                rarity: attr.rarity,
                score: attr.score
              }
            }),
          }
        },
      })

      updatedNftMetaPromises.push(updatedNftMeta)
      count++;
    }

    await Promise.all(updatedNftMetaPromises)
    this.logger.log(`[scraping ${contract_key}] Rarity and Ranking saved for ${updatedNftMetaPromises.length} Meta`);
  };

  async loadCollectionAttributes(collectionId, contract_key) {
    this.logger.log(`[scraping ${contract_key}] Running createAttributes()`);
  
    const nftMetas = await this.prismaService.nftMeta.findMany({
      where: {
        collection_id: collectionId
      },
      include: {
        attributes: true
      }
    })

    let collectionAttributePromises = []
    for (let i = 0; i < nftMetas.length; i++) {
      const collectionAndCollectionAttributes = await this.prismaService.collection.update({
        where: {
          id: collectionId
        },
        data: {
          attributes: {
            createMany: {
              data: nftMetas[i].attributes.map((attr) => {
                return {
                  trait_type: attr.trait_type,
                  value: attr.value,
                  rarity: attr.rarity,
                  total: Number(Number((attr.rarity * nftMetas.length)).toFixed(0))
                }
              }),
              skipDuplicates: true
            }
          }
        }
      })
      collectionAttributePromises.push(collectionAndCollectionAttributes)

      if (i % 100 === 0) {
        this.logger.log(`[scraping ${contract_key}] CollectionAttributes batch inserted`, collectionAttributePromises.length);
        await Promise.all(collectionAttributePromises)
        collectionAttributePromises = []
      } 
    }

    this.logger.log(`[scraping ${contract_key}] CollectionAttributes batch inserted`, collectionAttributePromises.length);
    await Promise.all(collectionAttributePromises)
  };

  async getTokensFromParas() {
    // const res = await axios.get("https://api-v2-mainnet.paras.id/token", {
    //   params: {
    //     collection_id: "blissedkong.near"
    //   }
    // })
  }

  async getContractAndTokenMetaData(contract_key) {
    const near = await connect(nearConfig);
    const account = await near.account(nearAccountId);
    const contract = await this.getContract(contract_key, account);
    const collectionSize = await contract.nft_total_supply();

    // let nftTokensBatchSize = 100
    // let tokenMetas = []
    // for (let i = 0; i < collectionSize; i += nftTokensBatchSize) {
    //   const currentTokenMetasBatch = await contract.nft_tokens({
    //     from_index: Number(i).toString(),
    //     limit: nftTokensBatchSize
    //   });
    //   tokenMetas = tokenMetas.concat(currentTokenMetasBatch);
    //   // await delay(1000); 
    // }

    let tokenMetas = []
    let tokenMetaPromises = []
    for (let i = 0; i < collectionSize; i++) {
      const tokenMetaPromise = contract.nft_token({token_id: Number(i).toString()})
      tokenMetaPromises.push(tokenMetaPromise)
      if (i % 100 === 0) {
        const tokenMetasBatch = await Promise.all(tokenMetaPromises)
        tokenMetas = tokenMetas.concat(tokenMetasBatch);
        tokenMetaPromises = []
      } 
    }

    const tokenMetasBatch = await Promise.all(tokenMetaPromises)
    tokenMetas = tokenMetas.concat(tokenMetasBatch);

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

  async getTokenIpfsMeta(nftContractMetadata, tokenMeta) {
    let tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, tokenMeta.metadata.reference);
    if (!tokenIpfsUrl || tokenIpfsUrl && tokenIpfsUrl == "") return

    if (tokenIpfsUrl.includes('ipfs')) {
      tokenIpfsUrl = this.ipfsHelperService.getByzIpfsUrl(tokenIpfsUrl);
    }

    let tokenIpfsMeta
    try {
      const { data } = await axios.get(tokenIpfsUrl);
      tokenIpfsMeta = data
    } catch(err) {
      this.logger.error(err)
      this.logger.log(`Error failed with IPFS URL: ${tokenIpfsUrl}`)
      this.logger.log(`and token meta data: ${JSON.stringify(tokenMeta.metadata, null, 4)}`)
    }
    return tokenIpfsMeta
  }

  async getNftMetaAttributes(nftContractMetadata, tokenMeta, contract_key) {
    let attributes = []
    if (contract_key == "misfits.tenk.near") {
      const tokenIpfsMeta = await this.getTokenIpfsMeta(nftContractMetadata, tokenMeta)
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
      const tokenIpfsMeta = await this.getTokenIpfsMeta(nftContractMetadata, tokenMeta)
      attributes = tokenIpfsMeta.attributes;
    }

    if (!attributes) {
      attributes = [
        {
          trait_type: contract_key,
          value: nftContractMetadata.name
        }
      ]
    }
    return attributes
  }
}
