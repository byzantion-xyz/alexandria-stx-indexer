import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Collection } from "src/entities/Collection";
import { CollectionAttribute } from "src/entities/CollectionAttribute";
import { CollectionCreator } from "src/entities/CollectionCreator";
import { CollectionScrape } from "src/entities/CollectionScrape";
import { NftMeta } from "src/entities/NftMeta";
import { NftMetaAttribute } from "src/entities/NftMetaAttribute";
import { SmartContract } from "src/entities/SmartContract";
import {
  CollectionScrapeOutcome,
  CollectionScrapeStage,
  SmartContractType,
} from "src/indexers/common/helpers/indexer-enums";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";

const NEAR_PROTOCOL_DB_ID = "174c3df6-0221-4ca7-b966-79ac8d981bdb";

@Injectable()
export class DbHelperService {
  private readonly logger = new Logger(DbHelperService.name);

  constructor(
    @InjectRepository(SmartContract)
    private smartContractRepo: Repository<SmartContract>,
    @InjectRepository(Collection)
    private collectionRepo: Repository<Collection>,
    // @InjectRepository(CollectionAttribute)
    // private collectionAttributeRepo: Repository<CollectionAttribute>,
    @InjectRepository(CollectionScrape)
    private collectionScrapeRepo: Repository<CollectionScrape>,
    @InjectRepository(CollectionCreator)
    private collectionCreatorRepo: Repository<CollectionCreator>,
    @InjectRepository(NftMeta)
    private nftMetaRepo: Repository<NftMeta> // @InjectRepository(NftMetaAttribute) // private nftMetaAttributeRepo: Repository<NftMetaAttribute>
  ) {}

  // ####### Smart Contract Functions

  async createSmartContract(contract_key: string, slug: string) {
    this.logger.log(`[scraping ${slug}] Creating SmartContract...`);
    const smartContractData = {
      contract_key: contract_key,
      type: SmartContractType.non_fungible_tokens,
      chain_id: NEAR_PROTOCOL_DB_ID,
    };

    let smartContract = await this.smartContractRepo.findOneBy({ contract_key });
    if (!smartContract) {
      smartContract = this.smartContractRepo.create();
    }
    this.smartContractRepo.merge(smartContract, smartContractData);
    // this.logger.log("smartContract", JSON.stringify(smartContract, null, 2));
    return await this.smartContractRepo.save(smartContract);
  }

  async loadSmartContract(nftContractMetadata, contract_key, slug) {
    this.logger.log(`[scraping ${slug}] Loading Smart Contract`);

    const data = {
      contract_key: contract_key,
      spec: nftContractMetadata.spec,
      name: nftContractMetadata.name,
      type: SmartContractType.non_fungible_tokens,
      asset_name: contract_key,
      chain_id: NEAR_PROTOCOL_DB_ID,
      json_meta: {
        chain_meta: nftContractMetadata,
      },
    };

    // const smartContractOld = await this.prismaService.smartContract.upsert({
    //   where: { contract_key: contract_key },
    //   update: data,
    //   create: data,
    //   select: { id: true },
    // });
    let smartContract = await this.smartContractRepo.findOneBy({ contract_key });
    if (!smartContract) {
      smartContract = this.smartContractRepo.create();
    }
    this.smartContractRepo.merge(smartContract, data);

    return await this.smartContractRepo.save(smartContract);
  }

  // ######## Collection Functions

  async createCollection(smartContractId: string, slug: string) {
    this.logger.log(`[scraping ${slug}] Creating Collection...`);

    let collection = await this.collectionRepo.findOneBy({ slug });
    if (!collection) {
      collection = this.collectionRepo.create({ slug: slug, smart_contract_id: smartContractId });
    }
    return await this.collectionRepo.save(collection);

    // return await this.prismaService.collection.upsert({
    //   where: { slug: slug },
    //   update: {},
    //   create: { slug: slug, smart_contract_id: smartContractId },
    //   select: { id: true },
    // });
  }

  async upsertCollection(slug: string, data: any) {
    let collection = await this.collectionRepo.findOneBy({ slug });

    if (!collection) {
      collection = this.collectionRepo.create();
    }
    this.collectionRepo.merge(collection, data);

    return await this.collectionRepo.save(collection);

    // const loadedCollection = await this.prismaService.collection.upsert({
    //   where: { slug: slug },
    //   update: data,
    //   create: data,
    // });
  }

  async findCollectionBy(finder: any) {
    return await this.collectionRepo.findOneBy(finder);
  }

  // ################################# CollectionAttribute Functions

  async setCollectionAttributes(collectionId: string) {
    // delete
    const sqlDelete = "delete from collection_attribute where collection_id = $1";
    const delResult = await this.collectionRepo.query(sqlDelete, [collectionId]);
    // this.logger.debug("setCollectionAttributes delete result", delResult);

    // insert
    const sql = `insert into collection_attribute(collection_id, trait_type, value, rarity, total)
    select nm.collection_id, nma.trait_type, nma.value, max(nma.rarity), 0 
      from nft_meta_attribute nma 
      join nft_meta nm on nma.meta_id = nm.id
      where nm.collection_id = $1
      group by nma.trait_type, nma.value, nm.collection_id`;
    const params = [collectionId];

    const result = await this.collectionRepo.query(sql, params);
    // this.logger.debug("setCollectionAttributes insert result", delResult);

    return result;
  }

  // ################################# CollectionScrape Functions

  async createCollectionScrape(collectionId, slug) {
    this.logger.log(`[scraping ${slug}] Creating CollectionScrape...`);

    let collectionScrape = await this.collectionScrapeRepo.findOneBy({ collection_id: collectionId });
    if (!collectionScrape) {
      collectionScrape = this.collectionScrapeRepo.create({ collection_id: collectionId });
    }
    return await this.collectionRepo.save(collectionScrape);

    // return await this.prismaService.collectionScrape.upsert({
    //   where: { collection_id: collectionId },
    //   update: {},
    //   create: { collection_id: collectionId },
    //   select: { id: true },
    // });
  }

  async countCurrentScrapes() {
    // const condition = {
    //   stage: { notIn: [CollectionScrapeStage.getting_tokens, CollectionScrapeStage.done] },
    //   outcome: { not: CollectionScrapeOutcome.failed }
    // };
    // return await this.collectionScrapeRepository.count(condition);
    const query = this.collectionScrapeRepo
      .createQueryBuilder()
      .where(
        `stage NOT IN ('${CollectionScrapeStage.getting_tokens}', '${CollectionScrapeStage.done}') AND outcome != '${CollectionScrapeOutcome.failed}'`
      );
    return await query.getCount();
  }

  async updateCollectionScrape(where, data) {
    await this.collectionScrapeRepo.update(where, data);
  }

  async findCollectionScrapeByCollectionId(collection_id) {
    return await this.collectionScrapeRepo.findOneBy({ collection_id });
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

    // await this.prismaService.collectionScrape.update({
    //   where: { collection_id: collectionId },
    //   data: {
    //     attempts: { increment: 1 },
    //     stage: CollectionScrapeStage.getting_tokens,
    //   },
    // });
  }

  async setCollectionScrapeStage(collectionId, stage) {
    await this.collectionScrapeRepo.update({ collection_id: collectionId }, { stage });

    // await this.prismaService.collectionScrape.update({
    //   where: { collection_id: collectionId },
    //   data: { stage: stage },
    // });
  }

  // ################################# CollectionCreator Functions

  async createCollectionCreator(collectionId, creatorWalletId, slug) {
    this.logger.log(`[scraping ${slug}] Creating CollectionCreator`);

    await this.collectionCreatorRepo.upsert({ collection_id: collectionId, wallet_id: creatorWalletId }, [
      "collection_id",
    ]);

    // const collectionCreator = await this.prismaService.collectionCreator.upsert({
    //   where: { collection_id: collectionId },
    //   update: { wallet_id: creatorWalletId },
    //   create: { collection_id: collectionId, wallet_id: creatorWalletId },
    //   select: { id: true },
    // });
    // return collectionCreator;
  }

  // ################################# NftMeta Functions

  async findOneNftMeta(collectionId: string, tokenId: string) {
    const finder = {
      where: {
        collection_id: collectionId,
        token_id: tokenId ?? "",
      },
    };
    return this.nftMetaRepo.findOne(finder);

    // const nftMeta = await this.prismaService.nftMeta.findUnique({
    //   where: {
    //     collection_id_token_id: {
    //       collection_id: collection.id,
    //       token_id: tokenMetas[i]?.token_id ?? "",
    //     },
    //   },
    // });
  }

  async insertNftMeta(dataNftMeta) {
    const nftMeta = this.nftMetaRepo.create(dataNftMeta) as unknown as NftMeta;
    // this.logger.debug("NftMeta object", JSON.stringify(nftMeta, null, 2));
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
}
