import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SmartContractType } from '@prisma/client'
import console from 'console';
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
    await this.loadNftMetas(tokenMetas, nftContractMetadata, smartContract.id, contract_key, collectionSize);
    await this.loadNftMetaAttributes(tokenMetas, nftContractMetadata, smartContract.id, contract_key);
    await this.loadCollection(tokenMetas, nftContractMetadata, contract_key, collectionSize);
    await this.updateRarity(smartContract, contract_key);
    return "Success"
  }

  async loadSmartContract(nftContractMetadata, contract_key) {
    this.logger.debug('loadSmartContract');
    const smartContract = await this.prismaService.smartContract.upsert({
      where: {
        contract_key: contract_key
      },
      update: {},
      create: {
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
      select: {
        id: true,
        frozen: true
      }
    })
    return smartContract
  }

  async loadNftMetas(tokenMetas, nftContractMetadata, smartContractId, contract_key, collectionSize) {
    let nftMetaInsertBatch = []
    for (let i = 0; i < tokenMetas.length; i++) {

      const nftMeta = await this.prismaService.nftMeta.findFirst({
        where: {
          smart_contract_id: smartContractId,
          token_id: tokenMetas[i].token_id
        },
      })

      if (!nftMeta) {
        const mediaUrl = this.getTokenIpfsMediaUrl(nftContractMetadata.base_uri, tokenMetas[i].metadata.media)
        nftMetaInsertBatch.push({
          smart_contract_id: smartContractId,
          chain_id: NEAR_PROTOCOL_DB_ID,
          name: tokenMetas[i].metadata.title,
          image: mediaUrl,
          token_id: tokenMetas[i].token_id,
          rarity: 0,
          ranking: 0,
        });
      }

      if (i % 100 === 0) this.logger.debug(`[scraping ${contract_key}] Metas processed: ${i} of ${collectionSize}`);
    };

    // Perform a batch insert of the NftMetas into the database
    await this.prismaService.nftMeta.createMany({
      data: nftMetaInsertBatch
    })
    this.logger.debug(`[scraping ${contract_key}] NftMeta batch inserted`, nftMetaInsertBatch.length);
  }

  async loadNftMetaAttributes(tokenMetas, nftContractMetadata, smartContractId, contract_key) {
    // Get all of the NftMetas in the contract, select only the id field
    const nftMetas = await this.prismaService.nftMeta.findMany({
      where: {
        smart_contract_id: smartContractId
      },
      select: {
        id: true,
      },
    })

    // Loop through each of the NftMetas and add the NftMetaAttributes for each of them
    for (let i = 0; i < nftMetas.length; i++) {
      const attributes = await this.getNftMetaAttributes(nftContractMetadata, tokenMetas[i], contract_key);

      await this.prismaService.nftMeta.update({
        where: {
          id: nftMetas[i].id
        },
        data: {
          attributes: {
            createMany: {
              data: attributes
            },
          },
        },
      })
    };
    this.logger.debug(`[scraping ${contract_key}] NftMetaAttributes inserted`);
  }

  async loadCollection(tokenMetas, nftContractMetadata, contract_key, collectionSize) {
    this.logger.debug('loadCollection');

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
        cover_image: firstTokenIpfsImageUrl,
        title: nftContractMetadata.name,
        slug: contract_key
      }
    });
    return byzCollection
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
    let nftTokensBatchSize = 5 // batch size limit for nft_tokens() to avoid exceeded gas limit per call

    let tokenMetas = []
    for (let i = 0; i < 5; i += nftTokensBatchSize) {
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

  async getNftMetaAttributes(nftContractMetadata, tokenMeta, contract_key) {
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
          trait_type: contract_key,
          value: nftContractMetadata.name
        }
      ]
    }
    return attributes
  }

  async updateRarity(smartContract, contract_key, only_minted = false, override_frozen = false) {
    this.logger.debug(`[scraping ${contract_key}] Running updateRarity()`);
  
    if (smartContract.frozen && !override_frozen) {
      const msg = `[scraping ${contract_key}] Collection is frozen, rarity update abandoned`;
      this.logger.debug(msg);
      return msg;
    }

    let nftMetas = []
    if (only_minted) {
      this.logger.debug("NEED TO IMPLEMENT A FIND MANY ONLY SELECT MINTED NFT METAS");
    } else {
      nftMetas = await this.prismaService.nftMeta.findMany({
        where: {
          smart_contract_id: smartContract.id
        },
        include: {
          attributes: true
        }
      })
    }
  
    this.logger.debug(`[scraping ${contract_key}] Checking for Trait Count`);
    for (let nftMeta of nftMetas) {
      let hasTraitCount = false;
      for (let attr of nftMeta.attributes) {
        if (attr.trait_type == 'Trait Count') {
          hasTraitCount = true;
        }
      }

      if (hasTraitCount) {
        this.logger.debug(`[scraping ${contract_key}] SKIP - Adding Trait Count`);
      }
      else {
        this.logger.debug(`[scraping ${contract_key}] Adding Trait Count`);
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

        await this.prismaService.nftMeta.update({
          where: {
            id: nftMeta.id
          },
          data: {
            attributes: {
              create: {
                trait_type: 'Trait Count',
                value: attribute_count.toString()
              },
            }
          },
          include: {
            attributes: true
          }
        })
      }
    }

    this.logger.log(`[scraping ${contract_key}] Updating Rarity Scores...`);
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

    this.logger.debug(`[scraping ${contract_key}] Updating Rarity Scores to %`);
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
    this.logger.debug(`[scraping ${contract_key}] Updating Meta Rarity`);
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

    for (let nftMeta of nftMetas) {
      const hello = await this.prismaService.nftMeta.update({
        where: {
          id: nftMeta.id
        },
        data: {
          attributes: {
            deleteMany: {},
            createMany: {
              data: nftMeta.attributes,
            }
          }
        },
        include: {
          attributes: true
        },
      })

      this.logger.log("hello")
      this.logger.log("hello")
      this.logger.log("hello")
      this.logger.log("hello")
      this.logger.log("hello")
      this.logger.log("hello")
      this.logger.log(hello)
    }
  
    // console.log(`[scraping ${asset_name}] Saving Meta Rarity and Ranking`);
    // // Save the changes made above
    // let savePromises = [];
    // let cnt = 0;
    // for (let m in meta) {
    //   meta[m].ranking = Number(m) + 1;
    //   savePromises.push(meta[m].save());
    //   cnt++;
    //   if (cnt % 500 === 0) {
    //     await Promise.all(savePromises);
    //     savePromises = [];
    //     console.log(`[scraping ${asset_name}] Rarity and Ranking saved for ${cnt} Meta`);
    //   }
    // }
    // console.log(`[scraping ${asset_name}] Update Rarity done.`);
    return 'done';
  };
}
