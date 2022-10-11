import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Collection } from "src/database/universal/entities/Collection";
import { CollectionCreator } from "src/database/universal/entities/CollectionCreator";
import { CollectionScrape } from "src/database/universal/entities/CollectionScrape";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { NftMetaAttribute } from "src/database/universal/entities/NftMetaAttribute";
import { SmartContract } from "src/database/universal/entities/SmartContract";
import {
  CollectionScrapeOutcome,
  CollectionScrapeStage,
  SmartContractType,
} from "src/indexers/common/helpers/indexer-enums";
import { Repository } from "typeorm";

const NEAR_PROTOCOL_DB_ID = "174c3df6-0221-4ca7-b966-79ac8d981bdb";

@Injectable()
export class DbHelperService {
  private readonly logger = new Logger(DbHelperService.name);

  constructor(
    @InjectRepository(SmartContract)
    private smartContractRepo: Repository<SmartContract>,
    @InjectRepository(Collection)
    private collectionRepo: Repository<Collection>,
    @InjectRepository(CollectionScrape)
    private collectionScrapeRepo: Repository<CollectionScrape>,
    @InjectRepository(CollectionCreator)
    private collectionCreatorRepo: Repository<CollectionCreator>,
    @InjectRepository(NftMeta)
    private nftMetaRepo: Repository<NftMeta>,
    @InjectRepository(NftMetaAttribute)
    private nftMetaAttributeRepo: Repository<NftMetaAttribute>
  ) {}

  // ##########################################################
  // ################################# Smart Contract Functions

  async createSmartContract(contract_key: string, slug: string) {
    this.logger.log(`[scraping ${slug}] Creating SmartContract...`);
    const smartContractData: any = {
      contract_key: contract_key,
      type: [SmartContractType.non_fungible_tokens],
      chain_id: NEAR_PROTOCOL_DB_ID,
    };

    let smartContract = await this.smartContractRepo.findOneBy({ contract_key });
    if (!smartContract) {
      smartContract = this.smartContractRepo.create();
    }

    this.smartContractRepo.merge(smartContract, smartContractData);

    return await this.smartContractRepo.save(smartContract, { transaction: true });
  }

  async loadSmartContract(nftContractMetadata, contract_key, slug) {
    this.logger.log(`[scraping ${slug}] Loading Smart Contract`);

    const data = {
      contract_key: contract_key,
      spec: nftContractMetadata.spec ?? "",
      name: nftContractMetadata.name ?? "",
      type: [SmartContractType.non_fungible_tokens],
      asset_name: contract_key,
      chain_id: NEAR_PROTOCOL_DB_ID,
      json_meta: {
        chain_meta: nftContractMetadata ?? {},
      },
    };

    let smartContract = await this.smartContractRepo.findOneBy({ contract_key });
    if (!smartContract) {
      smartContract = this.smartContractRepo.create();
    }
    this.smartContractRepo.merge(smartContract, data);

    return await this.smartContractRepo.save(smartContract);
  }

  // ##########################################################
  // ################################# Collection Functions

  async createCollection(smartContractId: string, slug: string) {
    this.logger.log(`[scraping ${slug}] Creating Collection...`);

    let collection = await this.collectionRepo.findOneBy({ slug });
    if (!collection) {
      collection = this.collectionRepo.create({ slug: slug, smart_contract_id: smartContractId });
    }
    return await this.collectionRepo.save(collection);
  }

  async upsertCollection(slug: string, data: any) {
    let collection = await this.collectionRepo.findOneBy({ slug });

    if (!collection) {
      collection = this.collectionRepo.create();
    }
    this.collectionRepo.merge(collection, data);

    return await this.collectionRepo.save(collection);
  }

  async findCollectionBy(finder: any) {
    return await this.collectionRepo.findOneBy(finder);
  }

  // ##########################################################
  // ################################# CollectionAttribute Functions

  async setCollectionAttributes(collectionId: string) {
    // delete
    const sqlDelete = "delete from collection_attribute where collection_id = $1";
    const delResult = await this.collectionRepo.query(sqlDelete, [collectionId]);

    // insert
    const sql = `insert into collection_attribute(collection_id, trait_type, value, rarity)
    select nm.collection_id, nma.trait_type, nma.value, nma.rarity
      from nft_meta_attribute nma 
      join nft_meta nm on nma.meta_id = nm.id
      where nm.collection_id = $1
      group by nma.trait_type, nma.value, nm.collection_id, nma.rarity`;
    const params = [collectionId];

    return await this.collectionRepo.query(sql, params);
  }

  // ##########################################################
  // ################################# CollectionScrape Functions

  async createCollectionScrape(collectionId, slug) {
    this.logger.log(`[scraping ${slug}] Creating CollectionScrape...`);

    let collectionScrape = await this.collectionScrapeRepo.findOneBy({ collection_id: collectionId });
    // this.logger.debug("collectionScrape", JSON.stringify(collectionScrape));
    if (!collectionScrape) {
      collectionScrape = this.collectionScrapeRepo.create({ collection_id: collectionId });
    }
    return await this.collectionScrapeRepo.save(collectionScrape);
  }

  async countCurrentScrapes() {
    const query = this.collectionScrapeRepo
      .createQueryBuilder()
      .where(
        `stage NOT IN ('${CollectionScrapeStage.start}', '${CollectionScrapeStage.done}') AND outcome != '${CollectionScrapeOutcome.failed}'`
      );
    return await query.getCount();
  }

  async updateCollectionScrape(where, data) {
    await this.collectionScrapeRepo.update(where, data);
  }

  async findCollectionScrapeByCollectionId(collection_id) {
    return await this.collectionScrapeRepo.findOneBy({ collection_id: collection_id });
  }

  async incrementScrapeAttemptByOne(collectionId) {
    await this.collectionScrapeRepo
      .createQueryBuilder()
      .update()
      .set({
        attempts: () => "attempts + 1",
        stage: CollectionScrapeStage.getting_tokens,
      })
      .where("collection_id = :id", { id: collectionId })
      .execute();
  }

  async setCollectionScrapeStage(collectionId, stage) {
    await this.collectionScrapeRepo.update({ collection_id: collectionId }, { stage: stage });
  }

  // ##########################################################
  // ################################# CollectionCreator Functions

  async createCollectionCreator(collectionId, creatorWalletId, slug) {
    this.logger.log(`[scraping ${slug}] Creating CollectionCreator`);

    await this.collectionCreatorRepo.upsert({ collection_id: collectionId, wallet_id: creatorWalletId }, [
      "collection_id",
    ]);
  }

  // ##########################################################
  // ################################# NftMeta Functions

  async findOneNftMeta(smartContractId: string, tokenId: string) {
    const finder = {
      where: {
        smart_contract_id: smartContractId,
        token_id: tokenId ?? "",
      },
    };
    return this.nftMetaRepo.findOne(finder);
  }

  async insertNftMeta(dataNftMeta) {
    const nftMeta = this.nftMetaRepo.create(dataNftMeta) as unknown as NftMeta;
    return this.nftMetaRepo.save(nftMeta, { transaction: true });
  }

  async findNftMetasWithAttributes(finder) {
    return await this.nftMetaRepo.find({
      where: finder,
      select: ["id", "rarity"],
      relations: ["attributes"],
    });
  }

  async findNftMetasForPinning(collectionId: string, offset: number) {
    return await this.nftMetaRepo.find({
      select: ["id", "image", "token_id", "ranking"],
      where: { collection_id: collectionId },
      order: { ranking: "ASC" },
      skip: offset,
    });
  }

  async updateNftMeta(nftMeta) {
    return this.nftMetaRepo.save(nftMeta, { transaction: true });
  }

  // ##########################################################
  // ################################# NftMetaAttribute Functions

  async deleteNftMetaAttributes(meta_id) {
    return await this.nftMetaAttributeRepo.delete({ meta_id });
  }

  async insertNftMetaAttributes(dataNftMetaAttributes) {
    const nftMetaAttribute = this.nftMetaAttributeRepo.create(dataNftMetaAttributes) as unknown as NftMetaAttribute;
    return await this.nftMetaAttributeRepo.save(nftMetaAttribute, { transaction: true });
  }
}
