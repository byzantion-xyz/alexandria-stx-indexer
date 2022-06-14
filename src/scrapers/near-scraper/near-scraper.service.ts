import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmartContractType } from '@prisma/client'
import { CollectionDataLoadStage } from '@prisma/client'
import { CollectionDataLoadOutcome } from '@prisma/client'
import { IpfsHelperService } from '../providers/ipfs-helper.service';
import { runScraperData } from './dto/run-scraper-data.dto';
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

  async scrape(data: runScraperData) {
    const { contract_key, token_id, override_frozen = false } = data
    this.logger.log(`[scraping ${contract_key}] START SCRAPE`);

    let collection = await this.prismaService.collection.findUnique({ where: { slug: contract_key } })
    if (collection) {
      const collectionDataLoad = await this.prismaService.collectionDataLoad.findUnique({ where: { collection_id: collection.id } })
      if (collectionDataLoad && collectionDataLoad.stage == CollectionDataLoadStage.done) {
        this.logger.log(`[scraping ${contract_key}] Scrape skipped, already scraped.`);
        return "Collection already loaded"
      }
    } else {
      const collectionDataLoad = await this.prismaService.collection.create({
        data: {
          slug: contract_key,
          CollectionDataLoad: {
            create: {}
          }
        }
      })

      console.log("collectionDataLoad", collectionDataLoad)
    }

    const {tokenMetas, nftContractMetadata, collectionSize, error } = await this.getContractAndTokenMetaData(contract_key, token_id);
    if (error) {
      await this.prismaService.collectionDataLoad.update({ 
        where: { collection_id: collection.id },
        data: { 
          outcome: CollectionDataLoadOutcome.failed,
          outcome_msg: `[scraping ${contract_key}] SCRAPE FAILED
                      - first token meta: \`${tokenMetas[0]}\`
                      - nftContractMetadata: \`${nftContractMetadata}\`
                      - error: \`${error}\`
                      `
        }
      })
    }

    try {
      const smartContract = await this.loadSmartContract(nftContractMetadata, contract_key);
      const loadedCollection = await this.loadCollection(tokenMetas, nftContractMetadata, contract_key, collectionSize);

      await this.setCollectionDataLoadStage(loadedCollection.id, CollectionDataLoadStage.pinning);
      await this.pin(tokenMetas, nftContractMetadata, contract_key);
      
      await this.setCollectionDataLoadStage(loadedCollection.id, CollectionDataLoadStage.loading_nft_metas);
      await this.loadNftMetasAndTheirAttributes(tokenMetas, nftContractMetadata, smartContract.id, contract_key, loadedCollection);
      
      await this.setCollectionDataLoadStage(loadedCollection.id, CollectionDataLoadStage.updating_rarities);
      await this.updateRarities(contract_key, override_frozen);

      await this.setCollectionDataLoadStage(loadedCollection.id, CollectionDataLoadStage.creating_collection_attributes);
      await this.loadCollectionAttributes(contract_key);

    } catch(err) {
      let error = err.stack;
      if (err.isAxiosError) {
        error = JSON.stringify(err.toJSON(), null, 2);
        error.innerException = err.response.data;
      }

      let collection = await this.prismaService.collection.findUnique({ where: { slug: contract_key } })
      await this.prismaService.collectionDataLoad.update({ 
        where: { collection_id: collection.id },
        data: { 
          outcome: CollectionDataLoadOutcome.failed,
          outcome_msg: `[scraping ${contract_key}] SCRAPE FAILED
                      - first token meta: \`${tokenMetas[0]}\`
                      - nftContractMetadata: \`${nftContractMetadata}\`
                      - error: \`${error}\`
                      `
        }
      })
    }


    collection = await this.prismaService.collection.findUnique({ where: { slug: contract_key } })
    await this.prismaService.collectionDataLoad.update({ 
      where: { collection_id: collection.id },
      data: {
        stage: CollectionDataLoadStage.done,
        outcome: CollectionDataLoadOutcome.succeeded,
        outcome_msg: `[scraping ${contract_key}] Successfully scraped collection!`
      }
    })
    this.logger.log(`[scraping ${contract_key}] SCRAPING COMPLETE`);
    return "Finished"
  }

  async pin(tokenMetas, nftContractMetadata, contract_key) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${contract_key}] pin`);
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata?.base_uri, firstTokenMeta?.metadata?.reference);
    if (!firstTokenIpfsUrl.includes('ipfs')) return // if the metadata is not stored on ipfs return

    await this.ipfsHelperService.pinIpfsFolder(firstTokenIpfsUrl, `${contract_key}`);
    await delay(2000) // delay 2 seconds to ensure that the pinned byzantion pinata url is ready to query in the next step 
  };

  async loadSmartContract(nftContractMetadata, contract_key) {
    this.logger.log(`[scraping ${contract_key}] Loading Smart Contract`);
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
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${contract_key}] Loading Collection`);

    // get first token data for the collection record data
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.reference);
    const firstTokenIpfsImageUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, firstTokenMeta.metadata.media)
    const { data: tokenIpfsMeta } = await axios.get(firstTokenIpfsUrl);

    const hello = await this.prismaService.collection.findUnique({
      where: {
        slug: contract_key
      }
    })
    console.log("hello", hello)

    const loadedCollection = await this.prismaService.collection.upsert({
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
    return loadedCollection
  }

  async loadNftMetasAndTheirAttributes(tokenMetas, nftContractMetadata, smartContractId, contract_key, collection) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${contract_key}] Loading NftMetas and their NftMetaAttributes`);

    let nftMetaPromises = []
    for (let i = 0; i < tokenMetas.length; i++) {
      console.log("")
      console.log("")
      console.time("checkIfNftMetaExists");
      const nftMeta = await this.prismaService.nftMeta.findUnique({
        where: {
          smart_contract_id_token_id: {
            smart_contract_id: smartContractId,
            token_id: tokenMetas[i]?.token_id ?? ""
          }
        },
      })
      console.log("checkIfNftMetaExists: ");
      console.timeEnd("checkIfNftMetaExists");

      if (!nftMeta) {
        try {
          console.time("getIpfsData");
          const tokenIpfsMeta = await this.getTokenIpfsMeta(nftContractMetadata, tokenMetas[i]);

          let mediaUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, tokenMetas[i].metadata.media)
          if (mediaUrl && mediaUrl != "" && mediaUrl.includes('ipfs')) {
            mediaUrl = this.ipfsHelperService.getByzIpfsUrl(mediaUrl);
          }
  
          const attributes = await this.getNftMetaAttributesFromMeta(nftContractMetadata, tokenMetas[i], contract_key);
          
          console.log(`${tokenMetas[i].token_id} - getIpfsData: `);
          console.timeEnd("getIpfsData");

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
            console.time("promiseAllNftBatch");

            await Promise.all(nftMetaPromises)
            
            console.log(`${tokenMetas[i].token_id} - promiseAllNftBatch: `);
            console.timeEnd("promiseAllNftBatch");

            nftMetaPromises = []
            this.logger.log(`[scraping ${contract_key}] NftMetas processed: ${i} of ${tokenMetas.length}`);
          } 
        } catch(err) {
          this.logger.error(err);
          this.logger.error(`
            [scraping ${contract_key}] Error processing NftMeta: ${i} of ${tokenMetas.length}. 
            Token Meta: ${tokenMetas[i]}
          `);
        }
      }
    };
    await Promise.all(nftMetaPromises)
    this.logger.log(`[scraping ${contract_key}] NftMetas Processing COMPLETE`);
    return nftMetaPromises.length
  }

  async updateRarities(contract_key, override_frozen) {
    this.logger.log(`[scraping ${contract_key}] Running updateRarity()`);

    const smartContract = await this.prismaService.smartContract.findUnique({
      where: {
        contract_key: contract_key
      },
    })
  
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
      select: {
        id: true,
        rarity: true,
        attributes: {
          select: {
            trait_type: true,
            value: true,
            rarity: true,
            score: true
          }
        }
      },
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

    let updatedNftMetasPromises = []
    let count = 0;
    for (let nftMeta of nftMetas) {
      const updatedNftMeta = this.prismaService.nftMeta.update({
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

      updatedNftMetasPromises.push(updatedNftMeta);

      if (count % 5 === 0) {
        await Promise.all(updatedNftMetasPromises)

      } 
      if (count % 100 === 0) {
        this.logger.log(`[scraping ${contract_key}] Rarity and Rankings processed: ${count} of ${nftMetas.length}`);
      } 
      count++;
    }

    await Promise.all(updatedNftMetasPromises)
    this.logger.log(`[scraping ${contract_key}] All Rarity and Rankings updated`);
    return "Rarites/Rankings Updated"
  };

  async loadCollectionAttributes(contract_key) {
    this.logger.log(`[scraping ${contract_key}] Creating Collection Attributes`);

    const collection = await this.prismaService.collection.findUnique({
      where: {
        slug: contract_key
      }
    })

    const nftMetas = await this.prismaService.nftMeta.findMany({
      where: {
        collection_id: collection.id
      },
      include: {
        attributes: true
      }
    })

    this.logger.log(`[scraping ${contract_key}] Creating Collection Attributes: Found ${nftMetas.length} NftMetas`);

    let collectionAttributePromises = []
    for (let i = 0; i < nftMetas.length; i++) {
      const collectionAndCollectionAttributes = await this.prismaService.collection.update({
        where: {
          slug: contract_key
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
        this.logger.log(`[scraping ${contract_key}] CollectionAttributes batch inserted for ${i} of ${nftMetas.length} NftMetas`);
        await Promise.all(collectionAttributePromises)
        collectionAttributePromises = []
      } 
    }

    console.log(`[scraping ${contract_key}] CollectionAttributes batch inserted for ${nftMetas.length} NftMetas`);
    await Promise.all(collectionAttributePromises)
  };

  async getTokensFromParas() {
    // const res = await axios.get("https://api-v2-mainnet.paras.id/token", {
    //   params: {
    //     collection_id: "blissedkong.near"
    //   }
    // })
  }

  async getContractAndTokenMetaData(contract_key, token_id) {
    try {
      this.logger.log(`[scraping ${contract_key}] Getting Token Metas from Chain`);
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
     
      let startingTokenId = 0;
      if (token_id) startingTokenId = Number(token_id) - 1;
  
      let tokenMetas = []
      let tokenMetaPromises = []
      if (startingTokenId < Number(collectionSize)) {
        for (let i = startingTokenId; i < collectionSize; i++) {
          const tokenMetaPromise = contract.nft_token({token_id: Number(i + 1).toString()})
          tokenMetaPromises.push(tokenMetaPromise)
          if (i % 100 === 0) {
            const tokenMetasBatch = await Promise.all(tokenMetaPromises)
            tokenMetas = tokenMetas.concat(tokenMetasBatch);
            tokenMetaPromises = []
          } 
        }
    
        const tokenMetasBatch = await Promise.all(tokenMetaPromises)
        tokenMetas = tokenMetas.concat(tokenMetasBatch);
      }
  
      // get rid of null tokens
      tokenMetas = tokenMetas.filter(token => !!token)
  
      this.logger.log(`[scraping ${contract_key}] Number of NftMetas to process: ${tokenMetas.length}`);
  
      const nftContractMetadata = await contract.nft_metadata();
  
      return {
        tokenMetas,
        nftContractMetadata,
        collectionSize
      }
    } catch(err) {
      this.logger.error(`[scraping ${contract_key}] Error: ${err}`);
      return {
        error: err
      }
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
    if (!base_uri && !reference) return ""
    return `${base_uri}/${reference}`
  };
  
  getTokenIpfsMediaUrl(base_uri, media) {
    if (media.includes("https")) return media
    if (!base_uri && !media) return ""
    return `${base_uri}/${media}`
  };

  async getTokenIpfsMeta(nftContractMetadata, tokenMeta) {
    let tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata.base_uri, tokenMeta.metadata.reference);
    if (!tokenIpfsUrl || tokenIpfsUrl && tokenIpfsUrl == "") return

    if (tokenIpfsUrl.includes('ipfs') && nftContractMetadata.base_uri != "https://ipfs.fleek.co/ipfs") {
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

  async setCollectionDataLoadStage(collectionId, stage) {
    await this.prismaService.collectionDataLoad.update({ 
      where: { collection_id: collectionId },
      data: { stage: stage }
    })
  }

  async getNftMetaAttributesFromMeta(nftContractMetadata, tokenMeta, contract_key) {
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

    if (attributes && attributes.length > 0) {
      attributes = attributes.map((attr) => {
        return {
          trait_type: attr.trait_type,
          value: attr.value.toString()
        }
      })
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
