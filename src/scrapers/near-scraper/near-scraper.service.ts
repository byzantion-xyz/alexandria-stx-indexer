import { Injectable, Logger } from "@nestjs/common";
import { CollectionScrapeStage, CollectionScrapeOutcome } from "src/indexers/common/helpers/indexer-enums";
import { IpfsHelperService } from "../providers/ipfs-helper.service";
import { runScraperData } from "./dto/run-scraper-data.dto";
import { ContractConnectionService } from "./providers/contract-connection-service";
import { DbHelperService } from "../common/db-helper/db-helper.service";
import { NftMeta } from "src/database/universal/entities/NftMeta";

const axios = require("axios").default;
const https = require("https");

const NEAR_PROTOCOL_DB_ID = "174c3df6-0221-4ca7-b966-79ac8d981bdb";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const keepAliveAxios = axios.create({ httpsAgent: new https.Agent({ keepAlive: true }) });

@Injectable()
export class NearScraperService {
  private readonly logger = new Logger(NearScraperService.name);

  constructor(
    private dbHelper: DbHelperService,
    private readonly ipfsHelperService: IpfsHelperService,
    private readonly contractConnectionService: ContractConnectionService
  ) {}

  async scrape(data: runScraperData) {
    this.logger.log(`START SCRAPE`);
    const { slug: slugInput, contract_key, token_series_id, token_id, starting_token_id, ending_token_id } = data;
    const { scrape_non_custodial_from_paras = false, force_scrape = false, override_metadata = false} = data;
    let isParasCustodialCollection = false;
    if (token_series_id || slugInput) isParasCustodialCollection = true;

    // get collection slug
    let slug = slugInput;
    if (!slug) {
      slug = await this.getSlug(contract_key, token_series_id);
    }

    // create SmartContract, Collection, and CollectionScrape records if they don't exist
    const smartContract = await this.dbHelper.createSmartContract(contract_key, slug);
    const collection = await this.dbHelper.createCollection(smartContract.id, slug);
    const collectionScrape = await this.dbHelper.createCollectionScrape(collection.id, slug);

    // // Check if contract should be scraped and return (quit scrape process) if not
    try {
      await this.checkShouldScrape(scrape_non_custodial_from_paras, force_scrape, collection.id, slug);
    } catch (err) {
      return err.toString();
    }

    // // Should scrape, so increment scrape attempt
    await this.dbHelper.incrementScrapeAttemptByOne(collection.id);

    // // Get contract data from chain
    const contract = await this.contractConnectionService.connectNftContract(contract_key);
    const nftContractMetadata = await contract.nft_metadata();
    const collectionSize = await contract.nft_total_supply();
    // this.logger.debug(collectionSize);

    let tokenMetas = [];
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
          const tokens = await this.getTokensFromParasCustodialCollection(slug);
          tokenMetas = tokens;
        } else {
          const tokens = await this.getMultipleTokenMetasFromContract(
            contract,
            collectionSize,
            starting_token_id,
            ending_token_id,
            slug
          );
          tokenMetas = tokens;
        }
      }

      // load SmartContract with data from chain
      const smartContract = await this.dbHelper.loadSmartContract(nftContractMetadata, contract_key, slug);


      // load Collection with data from chain
      let collectionTitle = nftContractMetadata.name;
      if (isParasCustodialCollection) collectionTitle = tokenMetas[0].metadata.collection.trim();
      const loadedCollection = await this.loadCollection(
        tokenMetas,
        nftContractMetadata.base_uri,
        collectionTitle,
        collectionScrape.id,
        smartContract.id,
        slug
      );

      // create CollectionCreator if not exists
      let creatorWalletId = contract_key;
      if (isParasCustodialCollection) creatorWalletId = tokenMetas[0].metadata.creator_id;
      await this.dbHelper.createCollectionCreator(loadedCollection.id, creatorWalletId, slug);

      // If non-custodail, pin the first item's meta as it's the same hash for the whole folder of metas and images
      if (!isParasCustodialCollection) {
        await this.dbHelper.setCollectionScrapeStage(collection.id, CollectionScrapeStage.pinning_folder);
        await this.pinFolderHash(tokenMetas[0], nftContractMetadata.base_uri, slug);
      }

      // load NftMetas + NftMetaAttributes
      await this.dbHelper.setCollectionScrapeStage(collection.id, CollectionScrapeStage.loading_nft_metas);
      await this.loadNftMetasAndTheirAttributes(
        tokenMetas,
        nftContractMetadata.base_uri,
        smartContract.id,
        slug,
        loadedCollection,
        scrape_non_custodial_from_paras,
        isParasCustodialCollection,
        override_metadata
      );

      // update NftMeta + NftMetaAttributes rarities
      await this.dbHelper.setCollectionScrapeStage(collection.id, CollectionScrapeStage.updating_rarities);
      await this.updateRarities(slug);

      // create CollectionAttributes
      await this.dbHelper.setCollectionScrapeStage(collection.id, CollectionScrapeStage.creating_collection_attributes);
      await this.createCollectionAttributes(slug);

      // // if Paras custodial collection, pin each distinct token image to our pinata by sending tasks to rate-limited queue service
      // if (isParasCustodialCollection || contract_key == 'tinkerunion_nft.enleap.near') {
      //   await this.dbHelper.setCollectionScrapeStage(collection.id, CollectionScrapeStage.pinning_multiple_images);
      //   await this.pinMultipleImages({ slug: slug });
      // }

      // mark scrape as done and succeeded
      await this.markScrapeSuccess(collection.id, slug);
      this.logger.log(`[scraping ${slug}] SCRAPING COMPLETE`);
      return "Success";
    } catch (err) {
      this.logger.error(`[scraping ${slug}] Error while scraping: ${err}`);
      this.logger.debug(err.stack);
      await this.createCollectionScrapeError(err, nftContractMetadata.base_uri, tokenMetas[0], slug);
      return err.toString();
    }
  }

  async getSlug(contract_key, token_series_id) {
    this.logger.log(`[scraping ${contract_key}] Getting Slug...`);
    let slug = contract_key;
    if (token_series_id) {
      const res = await axios.get(`https://api-v2-mainnet.paras.id/token/${contract_key}::${token_series_id}`);
      slug = res.data.metadata.collection_id;
    }
    return slug;
  }

  async checkShouldScrape(scrape_non_custodial_from_paras, force_scrape, collectionId, slug) {
    this.logger.log(`[scraping ${slug}] Checking if scrape should continue...`);
    if (scrape_non_custodial_from_paras) return true;
    else {
      const numOfCurrentScrapes = await this.dbHelper.countCurrentScrapes();

      if (numOfCurrentScrapes > 3) {
        const skipMsg = `[scraping ${slug}] Scrape skipped, 3 scrapes already in progress.`;
        this.logger.log(skipMsg);
        await this.dbHelper.updateCollectionScrape(
          { collection_id: collectionId },
          {
            outcome: CollectionScrapeOutcome.skipped,
            outcome_msg: `[${slug}] Scrape skipped
                            \`${skipMsg}\``,
          }
        );
        return false;
      }

      const collectionScrape = await this.dbHelper.findCollectionScrapeByCollectionId(collectionId);
      if (collectionScrape.outcome == CollectionScrapeOutcome.succeeded && !force_scrape) {
        const errorMsg = `[scraping ${slug}] Scrape skipped, already scraped successfully.`;
        this.logger.log(errorMsg);
        throw new Error(errorMsg);
      }
      if (collectionScrape.attempts >= 2 && !force_scrape) {
        const errorMsg = `[scraping ${slug}] Contract scrape attempted twice already and failed. Check for errors in collectionScrape id: ${collectionScrape.id}. To re-scrape, pass in force_scrape: true, or set the SmartContractScrape.attempts back to 0.`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      return true;
    }
  }

  async pinFolderHash(firstTokenMeta, nftContractMetadataBaseUri, slug) {
    if (!firstTokenMeta) return;
    this.logger.log(`[scraping ${slug}] pin`);
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, firstTokenMeta?.metadata?.reference);
    if (!firstTokenIpfsUrl || !firstTokenIpfsUrl.includes("ipfs")) return; // if the metadata is not stored on ipfs return
    await this.ipfsHelperService.pinIpfsFolder(firstTokenIpfsUrl, `${slug}`);
  }

  async loadCollection(
    tokenMetas,
    nftContractMetadataBaseUri,
    collectionTitle,
    collectionScrape,
    smartContractId,
    slug
  ) {
    if (tokenMetas.length == 0) return;
    this.logger.log(`[scraping ${slug}] Loading Collection`);

    // get first token data for the collection record data
    const firstTokenMeta = tokenMetas[0];
    const firstTokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, firstTokenMeta.metadata.reference);
    const firstTokenIpfsImageUrl = this.getTokenIpfsMediaUrl(nftContractMetadataBaseUri, firstTokenMeta.metadata.media);
    let tokenIpfsMeta;
    if (firstTokenIpfsUrl && !firstTokenIpfsUrl.includes("ipfs.fleek.co")) {
      const res = await axios.get(firstTokenIpfsUrl);
      tokenIpfsMeta = res.data;
    }

    const data = {
      smart_contract_id: smartContractId,
      collection_scrape_id: collectionScrape,
      collection_size: Number(tokenMetas.length),
      description: firstTokenMeta?.metadata?.description || tokenIpfsMeta?.description || "",
      cover_image: this.ipfsHelperService.getByzIpfsUrl(firstTokenIpfsImageUrl),
      title: collectionTitle,
      slug: slug,
    };

    const loadedCollection = this.dbHelper.upsertCollection(slug, data);
    return loadedCollection;
  }

  async loadNftMetasAndTheirAttributes(
    tokenMetas,
    nftContractMetadataBaseUri,
    smartContractId,
    slug,
    collection,
    scrape_non_custodial_from_paras,
    isParasCustodialCollection,
    override_metadata
  ) {
    if (tokenMetas.length == 0) return;
    this.logger.log(`[scraping ${slug}] Loading NftMetas and their NftMetaAttributes`);

    let tokenIpfsMetas = [];
    if (!isParasCustodialCollection && slug != "tinkerunion_nft.enleap.near") {
      tokenIpfsMetas = await this.getAllTokenIpfsMetas(tokenMetas, nftContractMetadataBaseUri, slug);

      if (tokenIpfsMetas.length != 0 && tokenIpfsMetas.length != tokenMetas.length) {
        const error = `[scraping ${slug}] # of token ipfs metas (${tokenIpfsMetas.length}) does not equal # of tokens scraped from contract (${tokenMetas.length})`;
        throw new Error(error);
      }
    }

    let nftMetaPromises = [];
    // for (let i = 0; i < 10; i++) {
    for (let i = 0; i < tokenMetas.length; i++) {
      const nftMeta = await this.dbHelper.findOneNftMeta(collection.id, tokenMetas[i]?.token_id);
      
       // if nftMeta already exists and not overriding token metadata, skip loading it
      if (nftMeta && !override_metadata) continue;

      try {
        // get attributes
        let attributes = [];
        if (scrape_non_custodial_from_paras || isParasCustodialCollection) {
          attributes = tokenMetas[i].metadata.attributes;
        } else {
          attributes = this.getNftMetaAttributesFromMeta(tokenIpfsMetas[i], tokenMetas[i], slug);
        }

        // set default attribute if no attributes found
        if (!attributes || (Object.keys(attributes).length === 0 && attributes.constructor === Object)) {
          attributes = [
            {
              trait_type: slug,
              value: collection.title,
            },
          ];
        }

        // get mediaUrl
        let mediaUrl = this.getTokenIpfsMediaUrl(nftContractMetadataBaseUri, tokenMetas[i].metadata.media);
        if (mediaUrl && mediaUrl != "" && mediaUrl.includes("ipfs")) {
          mediaUrl = this.ipfsHelperService.getByzIpfsUrl(mediaUrl);
        }

        // if override_token_metadata, update the existing NftMeta, else insert new NftMeta
        let nftMetaUpdateOrInsert
        
        if (nftMeta && override_metadata) {
          nftMeta.smart_contract_id = smartContractId;
          nftMeta.chain_id = NEAR_PROTOCOL_DB_ID;
          nftMeta.collection_id = collection.id;
          nftMeta.name = tokenMetas[i].metadata.title;
          nftMeta.image = mediaUrl;
          nftMeta.token_id = tokenMetas[i].token_id;
          nftMeta.rarity = 0;
          nftMeta.ranking = 0;
          nftMeta.json_meta = {
            chain_meta: isParasCustodialCollection ? {} : tokenMetas[i],
            ipfs_meta: tokenIpfsMetas[i] ? tokenIpfsMetas[i] : {},
            paras_api_meta: isParasCustodialCollection ? tokenMetas[i] : {},
          };
          nftMeta.attributes = attributes;
          nftMetaUpdateOrInsert = this.dbHelper.updateNftMeta(nftMeta);
        } else {
          nftMetaUpdateOrInsert = this.dbHelper.insertNftMeta({
            smart_contract_id: smartContractId,
            chain_id: NEAR_PROTOCOL_DB_ID,
            collection_id: collection.id,
            name: tokenMetas[i].metadata.title,
            image: mediaUrl,
            token_id: tokenMetas[i].token_id,
            rarity: 0,
            ranking: 0,
            json_meta: {
              chain_meta: isParasCustodialCollection ? {} : tokenMetas[i],
              ipfs_meta: tokenIpfsMetas[i] ? tokenIpfsMetas[i] : {},
              paras_api_meta: isParasCustodialCollection ? tokenMetas[i] : {},
            },
            attributes
          });
        }

        nftMetaPromises.push(nftMetaUpdateOrInsert);

        if (i % 100 === 0) {
          await Promise.all(nftMetaPromises);
          nftMetaPromises = [];
        }
        if (i % 200 === 0) {
          this.logger.log(`[scraping ${slug}] NftMetas processed: ${i} of ${tokenMetas.length}`);
        }
      } catch (err) {
        this.logger.error(err);
        this.logger.error(`
          [scraping ${slug}] Error processing NftMeta: ${i} of ${tokenMetas.length}. 
          Token Meta: ${tokenMetas[i]}
        `);
      }
    }
    await Promise.all(nftMetaPromises);
    this.logger.log(`[scraping ${slug}] NftMetas processed: ${tokenMetas.length} of ${tokenMetas.length}`);
    return nftMetaPromises.length;
  }

  async updateRarities(slug) {
    this.logger.log(`[scraping ${slug}] Running updateRarities()`);

    const collection = await this.dbHelper.findCollectionBy({ slug: slug });

    this.logger.log(`[scraping ${slug}] Fetching all NftMetas + their NftMetaAttributes`);
    let nftMetas = [];
    nftMetas = await this.dbHelper.findNftMetasWithAttributes({ collection_id: collection.id });

    this.logger.log(`[scraping ${slug}] Adding Trait Counts`);
    for (let nftMeta of nftMetas) {
      let hasTraitCount = false;
      for (let attr of nftMeta.attributes) {
        if (attr.trait_type == "Trait Count") {
          hasTraitCount = true;
        }
      }

      if (!hasTraitCount) {
        let attribute_count = 0;
        for (let attr of nftMeta.attributes) {
          if (attr.value != "None" && attr.value != "none" && attr.value != null) {
            attribute_count++;
          }
        }

        nftMeta.attributes.push({
          trait_type: "Trait Count",
          value: attribute_count.toString(),
        });
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

    let updatedNftMetasPromises = [];
    let count = 0;
    for (let nftMeta of nftMetas) {
      nftMeta.ranking = Number(count) + 1;
      const nftMetaUpdate = this.dbHelper.updateNftMeta(nftMeta);
      updatedNftMetasPromises.push(nftMetaUpdate);

      if (count % 50 === 0) {
        await Promise.all(updatedNftMetasPromises);
        updatedNftMetasPromises = [];
        await delay(300);
      }
      if (count % 200 === 0) {
        this.logger.log(`[scraping ${slug}] Rarity and Rankings processed: ${count} of ${nftMetas.length}`);
      }
      count++;
    }

    await Promise.all(updatedNftMetasPromises);
    this.logger.log(`[scraping ${slug}] All Rarity and Rankings updated`);
    return "Rarites/Rankings Updated";
  }

  async createCollectionAttributes(slug) {
    this.logger.log(`[scraping ${slug}] Creating Collection Attributes`);
    this.logger.log(`[scraping ${slug}] Fetching all NftMetas + their NftMetaAttributes...`);

    const collection = await this.dbHelper.findCollectionBy({ slug: slug });
    this.logger.log(`[scraping ${slug}] Creating Collection Attributes for ${collection.slug}`);

    const result = this.dbHelper.setCollectionAttributes(collection.id);
    this.logger.log(`[scraping ${slug}] CollectionAttributes batch inserted for ${collection.slug}`, result);
  }

  getNftMetaAttributesFromMeta(tokenIpfsMeta, tokenMeta, slug) {
    let attributes = [];
    switch (slug) {
      case "misfits.tenk.near":
        if (!tokenIpfsMeta) return;
        for (const property in tokenIpfsMeta) {
          const newAttribute = {
            trait_type: property,
            value: tokenIpfsMeta[property],
          };
          attributes.push(newAttribute);
        }
        break;

      case "nearnautnft.near":
        let attributesObject = JSON.parse(tokenMeta.metadata.extra);
        for (const property in attributesObject) {
          const splitProperty = property.split("_");
          if (splitProperty[0] != "attributes") continue;
          const newAttribute = {
            trait_type: splitProperty[1].charAt(0).toUpperCase() + splitProperty[1].slice(1),
            value: attributesObject[property],
          };
          attributes.push(newAttribute);
        }
        break;

      case "engineart.near":
        attributes = JSON.parse(tokenMeta.metadata.extra);
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
          value: attr.value.toString(),
        };
      });
    }

    return attributes;
  }

  async getTokensFromParasCustodialCollection(slug) {
    // get tokens from collection_id from Paras API
    const MAX_BATCH_LIMIT = 100;
    let currentSkip = 0;
    let tokenMetas = [];
    while (true) {
      const res = await axios.get("https://api-v2-mainnet.paras.id/token", {
        params: {
          collection_id: slug,
          __skip: currentSkip,
          __limit: MAX_BATCH_LIMIT,
        },
      });
      if (!res.data.data.results || res.data.data.results.length == 0) break;
      tokenMetas.push(...res.data.data.results);
      currentSkip += MAX_BATCH_LIMIT;
    }

    return tokenMetas;
  }

  async getTokensFromParas(slug, collectionSize) {
    const MAX_BATCH_LIMIT = 100;
    let tokenMetas = [];
    for (let i = 0; i < collectionSize; i += MAX_BATCH_LIMIT) {
      const res = await axios.get("https://api-v2-mainnet.paras.id/token", {
        params: {
          collection_id: slug,
          __skip: i,
          __limit: MAX_BATCH_LIMIT,
        },
      });
      tokenMetas.push(...res.data.data.results);
      if (i % 200 === 0) {
        this.logger.log(`[scraping ${slug}] Retrieved ${i} of ${collectionSize} tokens' from PARAS API`);
      }
    }
    return tokenMetas;
  }

  async getTokenMetaFromContract(contract, token_id, slug) {
    this.logger.log(`[scraping ${slug}] Getting 1 Token Meta from The Chain`);
    return await contract.nft_token({ token_id: Number(token_id).toString() });
  }

  async getMultipleTokenMetasFromContract(contract, collectionSize, starting_token_id, ending_token_id, slug) {
    this.logger.log(`[scraping ${slug}] Getting Multiple Token Metas from The Chain`);
    let startingTokenId = 0;
    let endingTokenId = Number(collectionSize);

    const tokenZero = await contract.nft_token({ token_id: Number(0).toString() });
    if (!tokenZero) {
      startingTokenId = 1;
      endingTokenId++;
    }

    if (starting_token_id) startingTokenId = Number(starting_token_id) - 1;
    if (ending_token_id) endingTokenId = Number(ending_token_id);

    let tokenMetas = [];
    let tokenMetaPromises = [];
    if (startingTokenId < Number(collectionSize)) {
      for (let i = startingTokenId; i < endingTokenId; i++) {
        const tokenMetaPromise = contract.nft_token({ token_id: Number(i).toString() });
        tokenMetaPromises.push(tokenMetaPromise);
        if (i % 100 === 0) {
          const tokenMetasBatch = await Promise.all(tokenMetaPromises);
          tokenMetas.push(...tokenMetasBatch);
          tokenMetaPromises = [];
        }
      }

      const tokenMetasBatch = await Promise.all(tokenMetaPromises);
      tokenMetas.push(...tokenMetasBatch);
    }

    // get rid of null tokens
    tokenMetas = tokenMetas.filter((token) => !!token);

    // TODO: Don't forget to uncomment again!!!
    if (tokenMetas.length < Number(collectionSize)) {
      const errorMsg = `[scraping ${slug}] # of tokens scraped: ${
        tokenMetas.length
      } is less than # of tokens in contract ${Number(
        collectionSize
      )}. This means you need to re-scrape and pass in an ending_token_id that is at least ${Number(
        collectionSize
      )}. (So the iterator has a chance to scrape token_ids up to that number). This issue exists because the token supply has changed from the original supply. Check the collection on paras.id to see how high the token ids go.`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.logger.log(`[scraping ${slug}] Number of NftMetas to process: ${tokenMetas.length}`);
    return tokenMetas;
  }

  getTokenIpfsUrl(base_uri, reference) {
    if (base_uri == "https://nearnaut.mypinata.cloud/ipfs") return null;
    if (reference.includes("https")) return reference;
    if (!base_uri && !reference) return "";
    return `${base_uri}/${reference}`;
  }

  getTokenIpfsMediaUrl(base_uri, media) {
    if (media.includes("https")) return media;
    if (!base_uri && !media) return "";
    return `${base_uri}/${media}`;
  }

  fetchIpfsMeta(url) {
    return keepAliveAxios.get(url, {
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    });
  }

  async getAllTokenIpfsMetas(tokenMetas, nftContractMetadataBaseUri, slug) {
    let tokenIpfsMetaPromises = [];
    let tokenIpfsMetas = [];

    // for (let i = 0; i < 10; i++) {
    for (let i = 0; i < tokenMetas.length; i++) {
      let tokenIpfsUrl = this.getTokenIpfsUrl(nftContractMetadataBaseUri, tokenMetas[i].metadata.reference);
      if (!tokenIpfsUrl || (tokenIpfsUrl && tokenIpfsUrl == "")) continue;

      if (tokenIpfsUrl.includes("ipfs") && slug != "tinkerunion_nft.enleap.near") {
        tokenIpfsUrl = this.ipfsHelperService.getByzIpfsUrl(tokenIpfsUrl);
      }

      tokenIpfsMetaPromises.push(this.fetchIpfsMeta(tokenIpfsUrl));

      if (i % 8 === 0) {
        let ipfsMetasBatch;
        try {
          ipfsMetasBatch = await Promise.all(tokenIpfsMetaPromises);
        } catch (err) {
          throw new Error(err);
        }
        if (ipfsMetasBatch) {
          tokenIpfsMetas.push(...ipfsMetasBatch.filter((r) => r.status == 200).map((r) => r.data));
          await delay(350);
        }
        tokenIpfsMetaPromises = [];
      }
      if (i % 200 === 0) {
        this.logger.log(`[scraping ${slug}] Retrieved ${i} of ${tokenMetas.length} tokens' IPFS metadata`);
      }
    }

    // process the last batch
    const ipfsMetasBatch = await Promise.all(tokenIpfsMetaPromises);
    tokenIpfsMetas.push(...ipfsMetasBatch.filter((r) => r.status == 200).map((r) => r.data));

    return tokenIpfsMetas;
  }

  async markScrapeSuccess(collectionId, slug) {
    await this.dbHelper.updateCollectionScrape(
      { collection_id: collectionId },
      {
        stage: CollectionScrapeStage.done,
        outcome: CollectionScrapeOutcome.succeeded,
        outcome_msg: `[scraping ${slug}] Successfully scraped contract!`,
      }
    );
  }

  async createCollectionScrapeError(err, nftContractMetadataBaseUri, firstTokenMeta, slug) {
    let error = err.stack;
    if (err.isAxiosError) {
      error = JSON.stringify(err.toJSON(), null, 2);
      error.innerException = err.response.data;
    }

    const collection = await this.dbHelper.findCollectionBy({ slug: slug });
    await this.dbHelper.updateCollectionScrape(
      { collection_id: collection.id },
      {
        outcome: CollectionScrapeOutcome.failed,
        outcome_msg: `[${slug}] SCRAPE FAILED
                    - first token meta: \`${JSON.stringify(firstTokenMeta)}\`
                    - base uri: \`${JSON.stringify(nftContractMetadataBaseUri)}\`
                    - error: \`${error}\`
                    `,
      }
    );
  }

  async pinMultipleImages(data) {
    const { slug, offset = 0 } = data;
    this.logger.log(`[${slug}] Pinning Multiple Images...`);

    const collection = await this.dbHelper.findCollectionBy({ slug: slug });
    const nftMetas = await this.dbHelper.findNftMetasForPinning(collection.id, offset);

    for (let i = 0; i < nftMetas.length; i++) {
      const pinHash = this.ipfsHelperService.getPinHashFromUrl(nftMetas[i].image);
      try {
        const pinJob = await axios.post("https://byz-pinning-service.onrender.com/api/pin-hash", {
          hash: pinHash,
          name: `${slug} ${nftMetas[i]?.token_id} (Rank ${nftMetas[i]?.ranking}) - Image`,
        });
        if (pinJob.error) {
          throw new Error(`Error: ${pinJob.error}`);
        }
        if (pinJob.jobInfo) {
          throw new Error(`Error: ${pinJob.error} -- JobInfo: ${pinJob.jobInfo}`);
        }
      } catch (err) {
        throw new Error(err);
      }
    }
    this.logger.log(`[${slug}] Pinning Multiple Images Complete.`);
  }
}
