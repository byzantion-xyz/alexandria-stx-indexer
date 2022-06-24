import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmartContractType } from '@prisma/client'
import { CollectionScrapeStage } from '@prisma/client'
import { CollectionScrapeOutcome } from '@prisma/client'
import { IpfsHelperService } from '../providers/ipfs-helper.service';
import { runScraperData } from './dto/run-scraper-data.dto';
const axios = require('axios').default;
const https = require('https');

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

const keepAliveAxios = axios.create({httpsAgent: new https.Agent({ keepAlive: true })})

@Injectable()
export class NearScraperService {
  private readonly logger = new Logger(NearScraperService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ipfsHelperService: IpfsHelperService
  ) {}


  async scrape(data: runScraperData) {
    this.logger.log(`START SCRAPE`);
    const { contract_key, token_series_id, token_id, starting_token_id, ending_token_id } = data;
    const { scrape_non_custodial_from_paras = false, force_scrape = false } = data;
    let isParasCustodialCollection = false;
    if (token_series_id) isParasCustodialCollection = true;

    // get collection slug
    const slug = await this.getSlug(contract_key, token_series_id);
    
    // create SmartContract, Collection, and CollectionScrape tables if they don't exist
    const smartContract = await this.createSmartContract(contract_key, slug);
    const collection = await this.createCollection(smartContract.id, slug);
    const collectionScrape = await this.createCollectionScrape(collection.id, slug);

    // Check if contract should be scraped and return (quit scrape process) if not
    const shouldScrape = await this.checkShouldScrape(scrape_non_custodial_from_paras, force_scrape, collection.id, slug);
    if (!shouldScrape) return -1

    // Should scrape, so increment scrape attempt 
    await this.incrementScrapeAttemptByOne(collection.id);

    // Get contract data from chain
    const contract = await this.connectNftContract(contract_key);
    const nftContractMetadata = await contract.nft_metadata();
    const collectionSize = await contract.nft_total_supply();

    let tokenMetas = []
    try {
      // Get tokens in collection
      if (scrape_non_custodial_from_paras) {
        const tokens = await this.getTokensFromParas(slug, collectionSize);
        tokenMetas = tokens;
      } else {
        if (token_id != null || token_id != undefined) {
          const token = await this.getTokenMetaFromContract(contract, token_id, slug);
          tokenMetas.push(token);
        } 
        if (isParasCustodialCollection) {
          const tokens = await this.getTokensFromParasCustodialCollection(contract_key, token_series_id);
          tokenMetas = tokens;
        } else {
          const tokens = await this.getMultipleTokenMetasFromContract(contract, collectionSize, starting_token_id, ending_token_id, slug);
          tokenMetas = tokens;
        }
      }
    
      // load SmartContract with data from chain
      const smartContract = await this.loadSmartContract(nftContractMetadata, contract_key, slug);

      // load Collection with data from chain
      let collectionTitle = nftContractMetadata.name;
      if (isParasCustodialCollection) collectionTitle = tokenMetas[0].metadata.collection.trim();
      const loadedCollection = await this.loadCollection(tokenMetas, nftContractMetadata.base_uri, collectionTitle, collectionScrape.id, smartContract.id, slug);

      // create CollectionCreator if not exists
      let creatorWalletId = contract_key;
      if (isParasCustodialCollection) creatorWalletId = tokenMetas[0].metadata.creator_id;
      await this.createCollectionCreator(loadedCollection.id, creatorWalletId, slug);

      // pin IPFS to our pinata
      await this.setCollectionScrapeStage(collection.id, CollectionScrapeStage.pinning);
      if (isParasCustodialCollection) {
        // Pin each custodial nft image to our pinata (each paras custodial nft has a distinct image hash)
      } else {
        // Pin the first item's meta as it's the same hash for the whole folder of metas and images
        await this.pin(tokenMetas, nftContractMetadata.base_uri, slug);
      }
      
      // load NftMetas + NftMetaAttributes
      await this.setCollectionScrapeStage(collection.id, CollectionScrapeStage.loading_nft_metas);
      await this.loadNftMetasAndTheirAttributes(tokenMetas, nftContractMetadata.base_uri, smartContract.id, slug, loadedCollection, scrape_non_custodial_from_paras, isParasCustodialCollection);
      
      // update NftMeta + NftMetaAttributes rarities
      await this.setCollectionScrapeStage(collection.id, CollectionScrapeStage.updating_rarities);
      await this.updateRarities(slug);

      // create CollectionAttributes
      await this.setCollectionScrapeStage(collection.id, CollectionScrapeStage.creating_collection_attributes);
      await this.createCollectionAttributes(slug);

      // mark scrape as done and succeeded
      await this.markScrapeSuccess(collection.id, slug);
      this.logger.log(`[scraping ${slug}] SCRAPING COMPLETE`);
      return "Success"

    } catch(err) {
      this.logger.error(`[scraping ${slug}] Error while scraping: ${err}`);
      await this.createCollectionScrapeError(err, nftContractMetadata.base_uri, tokenMetas[0], slug);
      return err
    }
  }


  async getSlug(contract_key, token_series_id) {
    this.logger.log(`[scraping ${contract_key}] Getting Slug...`);
    let slug = contract_key
    if (token_series_id) {
      const res = await axios.get(`https://api-v2-mainnet.paras.id/token/${contract_key}::${token_series_id}`);
      slug = res.data.metadata.collection_id;
    }
    return slug
  }


  async checkShouldScrape(scrape_non_custodial_from_paras, force_scrape, collectionId, slug) {
    this.logger.log(`[scraping ${slug}] Checking if scrape should continue...`);
    if (scrape_non_custodial_from_paras) return true
    else {
      const numOfCurrentSrapes = await this.prismaService.collectionScrape.count({
        where: { 
          stage: { notIn: [CollectionScrapeStage.getting_tokens, CollectionScrapeStage.done] },
          outcome: { not: CollectionScrapeOutcome.failed }
        }
      })

      if (numOfCurrentSrapes > 3) {
        const skipMsg = `[scraping ${slug}] Scrape skipped, 3 scrapes already in progress.`;
        this.logger.log(skipMsg);
        await this.prismaService.collectionScrape.update({ 
          where: { collection_id: collectionId },
          data: { 
            outcome: CollectionScrapeOutcome.skipped,
            outcome_msg: `[${slug}] Scrape skipped
                          \`${skipMsg}\``
          }
        })
        return false
      }

      const collectionScrape = await this.prismaService.collectionScrape.findUnique({
        where: { collection_id: collectionId }
      })
      if (collectionScrape.outcome == CollectionScrapeOutcome.succeeded && !force_scrape) {
        this.logger.log(`[scraping ${slug}] Scrape skipped, already scraped successfully.`);
        return false
      }
      if (collectionScrape.attempts >= 2 && !force_scrape) {
        const errorMsg = `[scraping ${slug}] Contract scrape attempted twice already and failed. Check for errors in collectionScrape id: ${collectionScrape.id}. To re-scrape, pass in force_scrape: true, or set the SmartContractScrape.attempts back to 0.`;
        this.logger.error(errorMsg);
        return false
      }

      return true
    }
  }


  async pin(tokenMetas, nftContractMetadataBaseUri, slug) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${slug}] pin`);
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, firstTokenMeta?.metadata?.reference);
    if (!firstTokenIpfsUrl || !firstTokenIpfsUrl.includes('ipfs')) return // if the metadata is not stored on ipfs return

    await this.ipfsHelperService.pinIpfsFolder(firstTokenIpfsUrl, `${slug}`);
    await delay(5000) // delay 5 seconds to ensure that the pinned byzantion pinata url is ready to query in the next step 
  };


  async loadSmartContract(nftContractMetadata, contract_key, slug) {
    this.logger.log(`[scraping ${slug}] Loading Smart Contract`);

    const data = {
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
    }

    const smartContract = await this.prismaService.smartContract.upsert({
      where: { contract_key: contract_key },
      update: data,
      create: data,
      select: { id: true }
    })
    return smartContract
  }

  
  async createCollectionCreator(collectionId, creatorWalletId, slug) {
    this.logger.log(`[scraping ${slug}] Creating CollectionCreator`);

    const collectionCreator = await this.prismaService.collectionCreator.upsert({
      where: { collection_id: collectionId },
      update: { wallet_id: creatorWalletId },
      create: { collection_id: collectionId, wallet_id: creatorWalletId },
      select: { id: true }
    })
    return collectionCreator
  }


  async loadCollection(tokenMetas, nftContractMetadataBaseUri, collectionTitle, collectionScrape, smartContractId, slug) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${slug}] Loading Collection`);

    // get first token data for the collection record data
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, firstTokenMeta.metadata.reference);
    const firstTokenIpfsImageUrl = this.getTokenIpfsMediaUrl(nftContractMetadataBaseUri, firstTokenMeta.metadata.media);
    let tokenIpfsMeta;
    if (firstTokenIpfsUrl && !firstTokenIpfsUrl.includes("ipfs.fleek.co")) {
      const res = await axios.get(firstTokenIpfsUrl);
      tokenIpfsMeta = res.data
    }

    const data = {
      smart_contract_id: smartContractId,
      collection_scrape_id: collectionScrape,
      collection_size: Number(tokenMetas.length),
      description: firstTokenMeta?.metadata?.description || tokenIpfsMeta?.description || "",
      cover_image: this.ipfsHelperService.getByzIpfsUrl(firstTokenIpfsImageUrl),
      title: collectionTitle,
      slug: slug
    }

    const loadedCollection = await this.prismaService.collection.upsert({
      where: { slug: slug },
      update: data,
      create: data
    });
    return loadedCollection
  }


  async loadNftMetasAndTheirAttributes(tokenMetas, nftContractMetadataBaseUri, smartContractId, slug, collection, scrape_non_custodial_from_paras, isParasCustodialCollection) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${slug}] Loading NftMetas and their NftMetaAttributes`);

    let tokenIpfsMetas = []
    if (!isParasCustodialCollection) {
      tokenIpfsMetas = await this.getAllTokenIpfsMetas(tokenMetas, nftContractMetadataBaseUri, slug);

      if (tokenIpfsMetas.length != 0 && tokenIpfsMetas.length != tokenMetas.length) {
        const error = `[scraping ${slug}] # of token ipfs metas (${tokenIpfsMetas.length}) does not equal # of tokens scraped from contract (${tokenMetas.length})`
        throw new Error(error)
      }
    }

    let nftMetaPromises = []
    for (let i = 0; i < tokenMetas.length; i++) {

      const nftMeta = await this.prismaService.nftMeta.findUnique({
        where: {
          collection_id_token_id: {
            collection_id: collection.id,
            token_id: tokenMetas[i]?.token_id ?? ""
          }
        },
      })
      if (nftMeta) continue // if nftMeta already exists, skip loading it

      try {
        let attributes = []
        if (scrape_non_custodial_from_paras || isParasCustodialCollection) {
          attributes = tokenMetas[i].metadata.attributes;
        } else {
          attributes = this.getNftMetaAttributesFromMeta(tokenIpfsMetas[i], collection.title, tokenMetas[i], slug);
        }

        let mediaUrl = this.getTokenIpfsMediaUrl(nftContractMetadataBaseUri, tokenMetas[i].metadata.media)
        if (mediaUrl && mediaUrl != "" && mediaUrl.includes('ipfs')) {
          mediaUrl = this.ipfsHelperService.getByzIpfsUrl(mediaUrl);
        }

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
              "chain_meta": isParasCustodialCollection ? {} : tokenMetas[i],
              "ipfs_meta": tokenIpfsMetas[i] ? tokenIpfsMetas[i] : {},
              "paras_api_meta": isParasCustodialCollection ? tokenMetas[i] : {}
            }
          }
        })
        nftMetaPromises.push(nftMeta);

        if (i % 100 === 0) {
          await Promise.all(nftMetaPromises);
          nftMetaPromises = [];
        } 
        if (i % 200 === 0) {
          this.logger.log(`[scraping ${slug}] NftMetas processed: ${i} of ${tokenMetas.length}`);
        } 
      } catch(err) {
        this.logger.error(err);
        this.logger.error(`
          [scraping ${slug}] Error processing NftMeta: ${i} of ${tokenMetas.length}. 
          Token Meta: ${tokenMetas[i]}
        `);
      }
    }
    await Promise.all(nftMetaPromises)
    this.logger.log(`[scraping ${slug}] NftMetas processed: ${tokenMetas.length} of ${tokenMetas.length}`);
    return nftMetaPromises.length
  }


  async updateRarities(slug) {
    this.logger.log(`[scraping ${slug}] Running updateRarities()`);

    const collection = await this.prismaService.collection.findUnique({ where: { slug: slug } })
  
    this.logger.log(`[scraping ${slug}] Fetching all NftMetas + their NftMetaAttributes`);
    let nftMetas = []
    nftMetas = await this.prismaService.nftMeta.findMany({
      where: { collection_id: collection.id },
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
  
    this.logger.log(`[scraping ${slug}] Adding Trait Counts`);
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

    this.logger.log(`[scraping ${slug}] Calculating NftMetaAttribute Rarity Scores...`);
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

    this.logger.log(`[scraping ${slug}] Calculating NftMetaAttribute Rarity Scores to %`);
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

    this.logger.log(`[scraping ${slug}] Calculating NftMeta Rarities`);
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
            createMany: {
              data: nftMeta.attributes.map((attr) => {
                return {
                  trait_type: attr.trait_type,
                  value: attr.value,
                  rarity: attr.rarity,
                  score: attr.score
                }
              }),
              skipDuplicates: true
            }
          }
        },
      })

      updatedNftMetasPromises.push(updatedNftMeta);

      if (count % 50 === 0) {
        await Promise.all(updatedNftMetasPromises)
        updatedNftMetasPromises = []
        await delay(300)
      } 
      if (count % 200 === 0) {
        this.logger.log(`[scraping ${slug}] Rarity and Rankings processed: ${count} of ${nftMetas.length}`);
      } 
      count++;
    }

    await Promise.all(updatedNftMetasPromises)
    this.logger.log(`[scraping ${slug}] All Rarity and Rankings updated`);
    return "Rarites/Rankings Updated"
  };


  async createCollectionAttributes(slug) {
    this.logger.log(`[scraping ${slug}] Creating Collection Attributes`);
    this.logger.log(`[scraping ${slug}] Fetching all NftMetas + their NftMetaAttributes...`);
    const collection = await this.prismaService.collection.findUnique({ where: { slug: slug } })

    const nftMetas = await this.prismaService.nftMeta.findMany({
      where: { collection_id: collection.id },
      include: {
        attributes: true
      }
    })

    this.logger.log(`[scraping ${slug}] Creating Collection Attributes: Found ${nftMetas.length} NftMetas`);

    let collectionAttributePromises = []
    for (let i = 0; i < nftMetas.length; i++) {
      const collectionAndCollectionAttributes = await this.prismaService.collection.update({
        where: { slug: slug },
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
        await Promise.all(collectionAttributePromises)
        collectionAttributePromises = []
      } 
      if (i % 200 === 0) {
        this.logger.log(`[scraping ${slug}] CollectionAttributes batch inserted for ${i} of ${nftMetas.length} NftMetas`);
      } 
    }

    await Promise.all(collectionAttributePromises)
    this.logger.log(`[scraping ${slug}] CollectionAttributes batch inserted for ${nftMetas.length} NftMetas`);
  };


  getNftMetaAttributesFromMeta(tokenIpfsMeta, collectionTitle, tokenMeta, slug) {
    let attributes = []
    switch(slug) {
      case "misfits.tenk.near":
        if (!tokenIpfsMeta) return;
        for (const property in tokenIpfsMeta) {
          const newAttribute = {
            trait_type: property,
            value: tokenIpfsMeta[property]
          }
          attributes.push(newAttribute)
        }
        break;

      case "nearnautnft.near":
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
        break;

      case "engineart.near":
        attributes = JSON.parse(tokenMeta.metadata.extra)
        break;

      default:
        if (!tokenIpfsMeta) return;
        attributes = tokenIpfsMeta.attributes;
        break;
    }

    // make sure attribute values are strings
    if (attributes && attributes.length > 0) {
      attributes = attributes.map((attr) => {
        return {
          trait_type: attr.trait_type,
          value: attr.value.toString()
        }
      })
    }

    // set default attribute if no attributes found
    if (!attributes || Object.keys(attributes).length === 0 && attributes.constructor === Object) {
      attributes = [
        {
          trait_type: slug,
          value: collectionTitle
        }
      ]
    }
    
    return attributes
  }


  async getTokensFromParasCustodialCollection(contract_key, token_series_id) {
    // get collection_id from Paras API
    const res = await axios.get(`https://api-v2-mainnet.paras.id/token/${contract_key}::${token_series_id}`);
    const collection_id = res.data.metadata.collection_id;

    // get tokens from collection_id from Paras API
    const MAX_BATCH_LIMIT = 100;
    let currentSkip = 0;
    let tokenMetas = [];
    while (true) {
      const res = await axios.get("https://api-v2-mainnet.paras.id/token", {
        params: {
          collection_id: collection_id,
          __skip: currentSkip,
          __limit: MAX_BATCH_LIMIT
        }
      })
      if (!res.data.data.results || res.data.data.results.length == 0) break;
      tokenMetas.push(...res.data.data.results)
      currentSkip += MAX_BATCH_LIMIT;
    }

    return tokenMetas
  }


  async getTokensFromParas(slug, collectionSize) {
    const MAX_BATCH_LIMIT = 100;
    let tokenMetas = [];
    for (let i = 0; i < collectionSize; i += MAX_BATCH_LIMIT) {
      const res = await axios.get("https://api-v2-mainnet.paras.id/token", {
        params: {
          collection_id: slug,
          __skip: i,
          __limit: MAX_BATCH_LIMIT
        }
      })
      tokenMetas.push(...res.data.data.results);
      if (i % 200 === 0) {
        this.logger.log(`[scraping ${slug}] Retrieved ${i} of ${collectionSize} tokens' from PARAS API`);
      } 
    }
    return tokenMetas
  }


  async getTokenMetaFromContract(contract, token_id, slug) {
    this.logger.log(`[scraping ${slug}] Getting 1 Token Meta from The Chain`);
    return await contract.nft_token({token_id: Number(token_id).toString()})
  }


  async getMultipleTokenMetasFromContract(contract, collectionSize, starting_token_id, ending_token_id, slug) {
    this.logger.log(`[scraping ${slug}] Getting Multiple Token Metas from The Chain`);
    let startingTokenId = 0;
    let endingTokenId = Number(collectionSize)

    const tokenZero = await contract.nft_token({token_id: Number(0).toString()})
    if (!tokenZero) {
      startingTokenId = 1
      endingTokenId++
    }

    if (starting_token_id) startingTokenId = Number(starting_token_id) - 1;
    if (ending_token_id) endingTokenId = Number(ending_token_id);

    let tokenMetas = []
    let tokenMetaPromises = []
    if (startingTokenId < Number(collectionSize)) {
      for (let i = startingTokenId; i < endingTokenId; i++) {
        const tokenMetaPromise = contract.nft_token({token_id: Number(i).toString()})
        tokenMetaPromises.push(tokenMetaPromise)
        if (i % 100 === 0) {
          const tokenMetasBatch = await Promise.all(tokenMetaPromises)
          tokenMetas.push(...tokenMetasBatch);
          tokenMetaPromises = []
        } 
      }
  
      const tokenMetasBatch = await Promise.all(tokenMetaPromises)
      tokenMetas.push(...tokenMetasBatch);
    }

    // get rid of null tokens
    tokenMetas = tokenMetas.filter(token => !!token)

    if (tokenMetas.length < Number(collectionSize)) {
      const errorMsg = `[scraping ${slug}] # of tokens scraped: ${tokenMetas.length} is less than # of tokens in contract ${Number(collectionSize)}. This means you need to re-scrape and pass in an ending_token_id that is at least ${Number(collectionSize)}. (So the iterator has a chance to scrape token_ids up to that number). This issue exists because the token supply has changed from the original supply. Check the collection on paras.id to see how high the token ids go.`
      this.logger.error(errorMsg);
      throw new Error(errorMsg)
    }
    
    this.logger.log(`[scraping ${slug}] Number of NftMetas to process: ${tokenMetas.length}`);
    return tokenMetas
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


  async connectNftContract(contract_id) {
    const near = await connect(nearConfig);
    const account = await near.account(nearAccountId);
    const contract = await this.getContract(contract_id, account);
    return contract
  }


  getTokenIpfsUrl(base_uri, reference) {
    if (base_uri == 'https://nearnaut.mypinata.cloud/ipfs') return null
    if (reference.includes("https")) return reference
    if (!base_uri && !reference) return ""
    return `${base_uri}/${reference}`
  };
  

  getTokenIpfsMediaUrl(base_uri, media) {
    if (media.includes("https")) return media
    if (!base_uri && !media) return ""
    return `${base_uri}/${media}`
  };


  fetchIpfsMeta(url) {
    return keepAliveAxios.get(url, {
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      }
    });
  };


  async getAllTokenIpfsMetas(tokenMetas, nftContractMetadataBaseUri, slug) {
    let tokenIpfsMetaPromises = []
    let tokenIpfsMetas = []

    for (let i = 0; i < tokenMetas.length; i++) {
      let tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, tokenMetas[i].metadata.reference);
      if (!tokenIpfsUrl || tokenIpfsUrl && tokenIpfsUrl == "") continue 

      if (tokenIpfsUrl.includes('ipfs') && slug != "tinkerunion_nft.enleap.near") {
        tokenIpfsUrl = this.ipfsHelperService.getByzIpfsUrl(tokenIpfsUrl);
      }
  
      tokenIpfsMetaPromises.push(this.fetchIpfsMeta(tokenIpfsUrl))

      if (i % 10 === 0) {
        let ipfsMetasBatch;
        try {
          ipfsMetasBatch = await Promise.all(tokenIpfsMetaPromises)
        } catch(err) {
          throw new Error(err)
        }
        if (ipfsMetasBatch) {
          tokenIpfsMetas.push(...ipfsMetasBatch.filter((r) => r.status == 200).map((r) => r.data));
          await delay(300);
        }
        tokenIpfsMetaPromises = []
      } 
      if (i % 200 === 0) {
        this.logger.log(`[scraping ${slug}] Retrieved ${i} of ${tokenMetas.length} tokens' IPFS metadata`);
      } 
    }

    // process the last batch
    const ipfsMetasBatch = await Promise.all(tokenIpfsMetaPromises)
    tokenIpfsMetas.push(...ipfsMetasBatch.filter((r) => r.status == 200).map((r) => r.data));

    return tokenIpfsMetas
  }


  async createSmartContract(contract_key, slug) {
    this.logger.log(`[scraping ${slug}] Creating SmartContract...`);
    const smartContractData = {
      contract_key: contract_key,
      type: SmartContractType.non_fungible_tokens,
      chain: {
        connect: {
          id: NEAR_PROTOCOL_DB_ID,
        },
      }
    }
    
    return await this.prismaService.smartContract.upsert({ 
      where: { contract_key: contract_key },
      update: smartContractData,
      create: smartContractData,
      select: { id: true }
    })
  }


  async createCollection(smartContractId, slug) {
    this.logger.log(`[scraping ${slug}] Creating Collection...`);
    return await this.prismaService.collection.upsert({ 
      where:  { slug: slug },
      update: {},
      create: { slug: slug, smart_contract_id: smartContractId },
      select: { id: true }
    })
  }


  async createCollectionScrape(collectionId, slug) {
    this.logger.log(`[scraping ${slug}] Creating CollectionScrape...`);
    return await this.prismaService.collectionScrape.upsert({ 
      where: { collection_id: collectionId },
      update: {},
      create: { collection_id: collectionId },
      select: { id: true }
    })
  }


  async setCollectionScrapeStage(collectionId, stage) {
    await this.prismaService.collectionScrape.update({ 
      where: { collection_id: collectionId },
      data: { stage: stage }
    })
  }


  async incrementScrapeAttemptByOne(collectionId) {
    await this.prismaService.collectionScrape.update({ 
      where: { collection_id: collectionId },
      data: { 
        attempts: { increment: 1 },
        stage: CollectionScrapeStage.getting_tokens 
      }
    })
  }


  async markScrapeSuccess(collectionId, slug) {
    await this.prismaService.collectionScrape.update({ 
      where: { collection_id: collectionId },
      data: {
        stage: CollectionScrapeStage.done,
        outcome: CollectionScrapeOutcome.succeeded,
        outcome_msg: `[scraping ${slug}] Successfully scraped contract!`
      }
    })
  }


  async createCollectionScrapeError(err, nftContractMetadataBaseUri, firstTokenMeta, slug) {
    let error = err.stack;
    if (err.isAxiosError) {
      error = JSON.stringify(err.toJSON(), null, 2);
      error.innerException = err.response.data;
    }
    
    const collection = await this.prismaService.collection.findUnique({
      where: { slug: slug }, select: { id: true }
    })
    await this.prismaService.collectionScrape.update({ 
      where: { collection_id: collection.id },
      data: { 
        outcome: CollectionScrapeOutcome.failed,
        outcome_msg: `[${slug}] SCRAPE FAILED
                    - first token meta: \`${JSON.stringify(firstTokenMeta)}\`
                    - base uri: \`${JSON.stringify(nftContractMetadataBaseUri)}\`
                    - error: \`${error}\`
                    `
      }
    })
  }


  async pinMultipleImages(tokenMetas, nftContractMetadataBaseUri, slug) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${slug}] pin multiple`);

    let pinPromises = []
    for (let i = 0; i < tokenMetas.length; i++) {
      const tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, tokenMetas[i]?.metadata?.media);
      if (!tokenIpfsUrl || !tokenIpfsUrl.includes('ipfs')) continue // if the metadata is not stored on ipfs continue loop

      const pinHash = this.ipfsHelperService.getPinHashFromUrl(tokenIpfsUrl);
      const byzPinataPromise = this.ipfsHelperService.pinByHash(pinHash, `${slug} ${tokenMetas[i]?.token_id} Image`);
      pinPromises.push(byzPinataPromise);
      if (i % 5 === 0) {
        await Promise.all(pinPromises);
        pinPromises = [];
        await delay(200);
      }
    }
    await Promise.all(pinPromises);
  };
}
