import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmartContractType } from '@prisma/client'
import { SmartContractScrapeStage } from '@prisma/client'
import { SmartContractScrapeOutcome } from '@prisma/client'
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
    const { contract_key, token_id, starting_token_id, ending_token_id } = data
    const { scrape_from_paras_api = false, override_frozen = false, force_scrape = false } = data
    this.logger.log(`[scraping ${contract_key}] START SCRAPE`);

    // create SmartContract, SmartContractScrape, and Collection tables if they don't exist
    // returns the SmartContract
    const smartContract = await this.createInitialTablesIfNotExist(contract_key);

    // Check if contract should be scraped and return (quit scrape process) if not
    if (!scrape_from_paras_api) {
      const numOfCurrentSrapes = await this.prismaService.smartContractScrape.count({
        where: { stage: { notIn: [SmartContractScrapeStage.getting_tokens, SmartContractScrapeStage.done] } }
      })

      if (numOfCurrentSrapes > 3) {
        const skipMsg = `[scraping ${contract_key}] Scrape skipped, 3 scrapes already in progress.`;
        this.logger.log(skipMsg);
        await this.prismaService.smartContractScrape.update({ 
          where: { smart_contract_id: smartContract.id },
          data: { 
            outcome: SmartContractScrapeOutcome.skipped,
            outcome_msg: `[${contract_key}] Scrape skipped
                          \`${skipMsg}\``
          }
        })
        return "Contract scrape skipped--too many scrapes currenlty in progress."
      }

      const smartContractScrape = await this.prismaService.smartContractScrape.findUnique({
        where: { smart_contract_id: smartContract.id }
      })
      if (smartContractScrape.outcome == SmartContractScrapeOutcome.succeeded && !force_scrape) {
        this.logger.log(`[scraping ${contract_key}] Scrape skipped, already scraped successfully.`);
        return "Contract already scraped succesfully"
      }
      if (smartContractScrape.attempts >= 2 && !force_scrape) {
        const errorMsg = `[scraping ${contract_key}] Contract scrape attempted twice already and failed. Check for errors in SmartContractScrape id: ${smartContractScrape.id}. To re-scrape, pass in force_scrape: true, or set the SmartContractScrape.attempts back to 0.`;
        this.logger.error(errorMsg);
        return errorMsg
      }
    }

    // increment scrape attempt, and reset scrape stage to beginning
    await this.prismaService.smartContractScrape.update({ 
      where: { smart_contract_id: smartContract.id },
      data: { 
        attempts: { increment: 1 },
        stage: SmartContractScrapeStage.getting_tokens 
      }
    })

    // Get contract data from chain
    let contract_id = contract_key
    const isTokenSeries = contract_key.includes(':');
    if (isTokenSeries) contract_id = contract_key.split(':')[0]
    const contract = await this.connectNftContract(contract_id);
    const nftContractMetadata = await contract.nft_metadata();
    const collectionSize = await contract.nft_total_supply();

    // Get tokens data
    let tokenMetas = []
    if (scrape_from_paras_api) {
      const {tokens, error} = await this.getTokensFromParas(contract_key, collectionSize);
      tokenMetas = tokens;
      if (error) {
        await this.createSmartContractScrapeError(error, nftContractMetadata.base_uri, tokenMetas[0], contract_key);
        return
      }

    } else {
      if (token_id != null || token_id != undefined) {
        const token = await this.getTokenMetaFromContract(contract, token_id, contract_key);
        tokenMetas.push(token);
      } 
      if (isTokenSeries) {
        const { tokenMetas: tokens, error } = await this.hello(contract_key);
        tokenMetas = tokens;
        if (error) {
          await this.createSmartContractScrapeError(error, nftContractMetadata.base_uri, tokenMetas[0], contract_key);
          return
        }
      } else {
        const { tokenMetas: tokens, error } = await this.getMultipleTokenMetasFromContract(contract, collectionSize, starting_token_id, ending_token_id, contract_key);
        tokenMetas = tokens;
        if (error) {
          await this.createSmartContractScrapeError(error, nftContractMetadata.base_uri, tokenMetas[0], contract_key);
          return
        }
      }
    }

    try {
      // load SmartContract and Collection
      const smartContract = await this.loadSmartContract(nftContractMetadata, contract_key);
      let title = nftContractMetadata.name
      if (isTokenSeries) title = tokenMetas[0].metadata.title.split('#')[0]
      const loadedCollection = await this.loadCollection(tokenMetas, nftContractMetadata.base_uri, title, contract_key, collectionSize, smartContract);

      // pin IPFS to our pinata
      await this.setSmartContractScrapeStage(smartContract.id, SmartContractScrapeStage.pinning);
      await this.pin(tokenMetas, nftContractMetadata.base_uri, contract_key);
      
      // load NftMetas + NftMetaAttributes
      await this.setSmartContractScrapeStage(smartContract.id, SmartContractScrapeStage.loading_nft_metas);
      await this.loadNftMetasAndTheirAttributes(tokenMetas, nftContractMetadata.base_uri, smartContract.id, contract_key, loadedCollection, scrape_from_paras_api);
      
      // update NftMeta + NftMetaAttributes rarities
      await this.setSmartContractScrapeStage(smartContract.id, SmartContractScrapeStage.updating_rarities);
      await this.updateRarities(contract_key, override_frozen);

      // create CollectionAttributes
      await this.setSmartContractScrapeStage(smartContract.id, SmartContractScrapeStage.creating_collection_attributes);
      await this.createCollectionAttributes(contract_key);

      // mark scrape as done and succeeded
      await this.prismaService.smartContractScrape.update({ 
        where: { smart_contract_id: smartContract.id },
        data: {
          stage: SmartContractScrapeStage.done,
          outcome: SmartContractScrapeOutcome.succeeded,
          outcome_msg: `[scraping ${contract_key}] Successfully scraped contract!`
        }
      })
      this.logger.log(`[scraping ${contract_key}] SCRAPING COMPLETE`);

    } catch(err) {
      this.logger.error(`[scraping ${contract_key}] Error while scraping: ${err}`);
      let error = err.stack;
      if (err.isAxiosError) {
        error = JSON.stringify(err.toJSON(), null, 2);
        error.innerException = err.response.data;
      }
      await this.createSmartContractScrapeError(error, nftContractMetadata.base_uri, tokenMetas[0], contract_key);
      return "Failure"
    }
    return "Finished"
  }


  async pin(tokenMetas, nftContractMetadataBaseUri, contract_key) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${contract_key}] pin`);
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, firstTokenMeta?.metadata?.reference);
    if (!firstTokenIpfsUrl || !firstTokenIpfsUrl.includes('ipfs')) return // if the metadata is not stored on ipfs return

    await this.ipfsHelperService.pinIpfsFolder(firstTokenIpfsUrl, `${contract_key}`);
    await delay(5000) // delay 5 seconds to ensure that the pinned byzantion pinata url is ready to query in the next step 
  };


  async loadSmartContract(nftContractMetadata, contract_key) {
    this.logger.log(`[scraping ${contract_key}] Loading Smart Contract`);

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
      select: { id: true, frozen: true }
    })
    return smartContract
  }


  async loadCollection(tokenMetas, nftContractMetadataBaseUri, title, contract_key, collectionSize, smartContract) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${contract_key}] Loading Collection`);

    // get first token data for the collection record data
    const firstTokenMeta = tokenMetas[0]
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, firstTokenMeta.metadata.reference);
    const firstTokenIpfsImageUrl = this.getTokenIpfsMediaUrl(nftContractMetadataBaseUri, firstTokenMeta.metadata.media);
    let tokenIpfsMeta;
    if (firstTokenIpfsUrl) {
      const res = await axios.get(firstTokenIpfsUrl);
      tokenIpfsMeta = res.data
    }

    const loadedCollection = await this.prismaService.collection.upsert({
      where: { smart_contract_id: smartContract.id },
      update: {},
      create: {
        collection_size: Number(collectionSize),
        description: firstTokenMeta?.metadata?.description || tokenIpfsMeta?.description || "",
        cover_image: this.ipfsHelperService.getByzIpfsUrl(firstTokenIpfsImageUrl),
        title: title,
        slug: contract_key
      }
    });
    return loadedCollection
  }


  async loadNftMetasAndTheirAttributes(tokenMetas, nftContractMetadataBaseUri, smartContractId, contract_key, collection, scrape_from_paras_api) {
    if (tokenMetas.length == 0) return
    this.logger.log(`[scraping ${contract_key}] Loading NftMetas and their NftMetaAttributes`);

    const tokenIpfsMetas = await this.getAllTokenIpfsMetas(tokenMetas, nftContractMetadataBaseUri, contract_key);

    if (tokenIpfsMetas.length != 0 && tokenIpfsMetas.length != tokenMetas.length) {
      const error = `[scraping ${contract_key}] # of token ipfs metas (${tokenIpfsMetas.length}) does not equal # of tokens scraped from contract (${tokenMetas.length})`
      throw new Error(error)
    }

    let nftMetaPromises = []
    for (let i = 0; i < tokenMetas.length; i++) {

      const nftMeta = await this.prismaService.nftMeta.findUnique({
        where: {
          smart_contract_id_token_id: {
            smart_contract_id: smartContractId,
            token_id: tokenMetas[i]?.token_id ?? ""
          }
        },
      })
      if (nftMeta) continue // if nftMeta already exists, skip loading it

      try {
        let attributes = []
        if (scrape_from_paras_api) {
          attributes = tokenMetas[i].metadata.attributes;
        } else {
          attributes = this.getNftMetaAttributesFromMeta(tokenIpfsMetas[i], collection.title, tokenMetas[i], contract_key);
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
              "chain_meta": tokenMetas[i],
              "ipfs_meta": tokenIpfsMetas[i]
            }
          }
        })
        nftMetaPromises.push(nftMeta)

        if (i % 100 === 0) {
          await Promise.all(nftMetaPromises)
          nftMetaPromises = []
        } 
        if (i % 200 === 0) {
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
    await Promise.all(nftMetaPromises)
    this.logger.log(`[scraping ${contract_key}] NftMetas processed: ${tokenMetas.length} of ${tokenMetas.length}`);
    return nftMetaPromises.length
  }


  async updateRarities(contract_key, override_frozen) {
    this.logger.log(`[scraping ${contract_key}] Running updateRarities()`);

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

    this.logger.log(`[scraping ${contract_key}] Fetching all NftMetas + their NftMetaAttributes`);
    let nftMetas = []
    nftMetas = await this.prismaService.nftMeta.findMany({
      where: { smart_contract_id: smartContract.id },
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

    this.logger.log(`[scraping ${contract_key}] Calculating NftMetaAttribute Rarity Scores...`);
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

    this.logger.log(`[scraping ${contract_key}] Calculating NftMetaAttribute Rarity Scores to %`);
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

    this.logger.log(`[scraping ${contract_key}] Calculating NftMeta Rarities`);
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
        this.logger.log(`[scraping ${contract_key}] Rarity and Rankings processed: ${count} of ${nftMetas.length}`);
      } 
      count++;
    }

    await Promise.all(updatedNftMetasPromises)
    this.logger.log(`[scraping ${contract_key}] All Rarity and Rankings updated`);
    return "Rarites/Rankings Updated"
  };


  async createCollectionAttributes(contract_key) {
    this.logger.log(`[scraping ${contract_key}] Creating Collection Attributes`);

    this.logger.log(`[scraping ${contract_key}] Fetching all NftMetas + their NftMetaAttributes...`);
    const smartContract = await this.prismaService.smartContract.findUnique({
      where: { contract_key: contract_key }
    })

    const nftMetas = await this.prismaService.nftMeta.findMany({
      where: {
        smart_contract_id: smartContract.id
      },
      include: {
        attributes: true
      }
    })

    this.logger.log(`[scraping ${contract_key}] Creating Collection Attributes: Found ${nftMetas.length} NftMetas`);

    let collectionAttributePromises = []
    for (let i = 0; i < nftMetas.length; i++) {
      const collectionAndCollectionAttributes = await this.prismaService.collection.update({
        where: { smart_contract_id: smartContract.id },
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
        this.logger.log(`[scraping ${contract_key}] CollectionAttributes batch inserted for ${i} of ${nftMetas.length} NftMetas`);
      } 
    }

    await Promise.all(collectionAttributePromises)
    this.logger.log(`[scraping ${contract_key}] CollectionAttributes batch inserted for ${nftMetas.length} NftMetas`);
  };


  getNftMetaAttributesFromMeta(tokenIpfsMeta, collectionTitle, tokenMeta, contract_key) {
    let attributes = []
    switch(contract_key) {
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
          trait_type: contract_key,
          value: collectionTitle
        }
      ]
    }
    
    return attributes
  }

  async hello(contract_key) {
    try {
      const MAX_BATCH_LIMIT = 30;
      let currentSkip = 0;
      let tokenMetas = [];
      while (true) {
        const res = await axios.get("https://api-v2-mainnet.paras.id/token-series", {
          params: {
            collection_id: "nearjutsu-by-raidennftnear",
            __skip: currentSkip,
            __limit: MAX_BATCH_LIMIT
          }
        })
        if (!res.data.data.results) break;
        tokenMetas.push(...res.data.data.results)
        currentSkip += MAX_BATCH_LIMIT;
      }
      console.log(tokenMetas)
      console.log(tokenMetas.length)
      return {
        tokens: tokenMetas
      }
    } catch(err) {
      this.logger.error(`[scraping ${contract_key}] Error: ${err}`);
      return {
        error: err
      }
    }
  }


  async getTokensFromParas(contract_key, collectionSize) {
    try {
      const MAX_BATCH_LIMIT = 100;
      let tokenMetas = [];
      for (let i = 0; i < collectionSize; i += MAX_BATCH_LIMIT) {
        const res = await axios.get("https://api-v2-mainnet.paras.id/token", {
          params: {
            collection_id: contract_key,
            __skip: i,
            __limit: MAX_BATCH_LIMIT
          }
        })
        tokenMetas.push(...res.data.data.results);
        if (i % 200 === 0) {
          this.logger.log(`[scraping ${contract_key}] Retrieved ${i} of ${collectionSize} tokens' from PARAS API`);
        } 
      }
      return {
        tokens: tokenMetas
      }
    } catch(err) {
      this.logger.error(`[scraping ${contract_key}] Error: ${err}`);
      return {
        error: err
      }
    }
  }


  async getTokenMetaFromContract(contract, token_id, contract_key) {
    this.logger.log(`[scraping ${contract_key}] Getting 1 Token Meta from The Chain`);
    return await contract.nft_token({token_id: Number(token_id).toString()})
  }


  async getMultipleTokenMetasFromContract(contract, collectionSize, starting_token_id, ending_token_id, contract_key) {
    try {
      this.logger.log(`[scraping ${contract_key}] Getting Multiple Token Metas from The Chain`);
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
        const errorMsg = `[scraping ${contract_key}] # of tokens scraped: ${tokenMetas.length} is less than # of tokens in contract ${Number(collectionSize)}. This means you need to re-scrape and pass in an ending_token_id that is at least ${Number(collectionSize)}. (So the iterator has a chance to scrape token_ids up to that number). This issue exists because the token supply has changed from the original supply.`
        this.logger.error(errorMsg);
        return {
          tokenMetas,
          error: errorMsg
        }
      }

      this.logger.log(`[scraping ${contract_key}] Number of NftMetas to process: ${tokenMetas.length}`);
  
      return {
        tokenMetas
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


  async getAllTokenIpfsMetas(tokenMetas, nftContractMetadataBaseUri, contract_key) {
    let tokenIpfsMetaPromises = []
    let tokenIpfsMetas = []

    for (let i = 0; i < tokenMetas.length; i++) {
      let tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, tokenMetas[i].metadata.reference);
      if (!tokenIpfsUrl || tokenIpfsUrl && tokenIpfsUrl == "") continue 

      if (tokenIpfsUrl.includes('ipfs') && contract_key != "tinkerunion_nft.enleap.near") {
        tokenIpfsUrl = this.ipfsHelperService.getByzIpfsUrl(tokenIpfsUrl);
      }
  
      tokenIpfsMetaPromises.push(this.fetchIpfsMeta(tokenIpfsUrl))

      if (i % 10 === 0) {
        let ipfsMetasBatch;
        try {
          ipfsMetasBatch = await Promise.all(tokenIpfsMetaPromises)
        } catch(err) {
          this.logger.error(err);
          await this.createSmartContractScrapeError(err, nftContractMetadataBaseUri, tokenMetas[i], contract_key);
        }
        if (ipfsMetasBatch) {
          tokenIpfsMetas.push(...ipfsMetasBatch.filter((r) => r.status == 200).map((r) => r.data));
          await delay(300);
        }
        tokenIpfsMetaPromises = []
      } 
      if (i % 200 === 0) {
        this.logger.log(`[scraping ${contract_key}] Retrieved ${i} of ${tokenMetas.length} tokens' IPFS metadata`);
      } 
    }

    // process the last batch
    const ipfsMetasBatch = await Promise.all(tokenIpfsMetaPromises)
    tokenIpfsMetas.push(...ipfsMetasBatch.filter((r) => r.status == 200).map((r) => r.data));

    return tokenIpfsMetas
  }


  async createInitialTablesIfNotExist(contract_key) {
    let smartContract;
    let smartContractInDB = await this.prismaService.smartContract.findUnique({ where: { contract_key: contract_key } })
    if (smartContractInDB) smartContract = smartContractInDB
    if (!smartContractInDB) {
      smartContract = await this.prismaService.smartContract.create({
        data: {
          contract_key: contract_key,
          type: contract_key.includes(':') ? SmartContractType.token_series : SmartContractType.non_fungible_tokens,
          chain: {
            connect: {
              id: NEAR_PROTOCOL_DB_ID,
            },
          },
        },
        select: {
          id: true,
          frozen: true
        }
      })

      await this.prismaService.smartContractScrape.upsert({ 
        where: { smart_contract_id: smartContract.id },
        update: {},
        create: { smart_contract_id: smartContract.id }
      })

      await this.prismaService.collection.upsert({
        where: { smart_contract_id: smartContract.id },
        update: {},
        create: { smart_contract_id: smartContract.id },
      })
    }
    return smartContract
  }


  async setSmartContractScrapeStage(smartContractId, stage) {
    await this.prismaService.smartContractScrape.update({ 
      where: { smart_contract_id: smartContractId },
      data: { stage: stage }
    })
  }


  async createSmartContractScrapeError(error, nftContractMetadataBaseUri, firstTokenMeta, contract_key) {
    const smartContract = await this.prismaService.smartContract.findUnique({
      where: { contract_key: contract_key }, select: { id: true }
    })
    await this.prismaService.smartContractScrape.update({ 
      where: { smart_contract_id: smartContract.id },
      data: { 
        outcome: SmartContractScrapeOutcome.failed,
        outcome_msg: `[${contract_key}] SCRAPE FAILED
                    - first token meta: \`${JSON.stringify(firstTokenMeta)}\`
                    - base uri: \`${JSON.stringify(nftContractMetadataBaseUri)}\`
                    - error: \`${error}\`
                    `
      }
    })
  }

  // for edge cases like tinkerunion_nft.enleap.near that have a distinct pin hash for every meta or image
  // async pinMultiple(tokenMetas, nftContractMetadata, contract_key) {
  //   if (tokenMetas.length == 0) return
  //   this.logger.log(`[scraping ${contract_key}] pin multiple`);

  //   let pinPromises = []
  //   for (let tokenMeta of tokenMetas) {
  //     const tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadata?.base_uri, tokenMeta?.metadata?.reference);
  //     if (!tokenIpfsUrl || !tokenIpfsUrl.includes('ipfs')) continue // if the metadata is not stored on ipfs continue loop

  //     const pinHash = this.ipfsHelperService.getPinHashFromUrl(tokenIpfsUrl);
  //     const byzPinataPromise = this.ipfsHelperService.pinByHash(pinHash, `${contract_key} ${tokenMeta?.token_id}`);
  //     pinPromises.push(byzPinataPromise);
  //   }

  //   await Promise.all(pinPromises);
  // };
}
