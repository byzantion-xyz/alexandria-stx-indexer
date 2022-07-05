import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Collection } from "src/entities/Collection";
import { CollectionCreator } from "src/entities/CollectionCreator";
import { CollectionScrape } from "src/entities/CollectionScrape";
import { NftMeta } from "src/entities/NftMeta";
import { SmartContract } from "src/entities/SmartContract";
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
    private smartContractRepository: Repository<SmartContract>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    @InjectRepository(CollectionScrape)
    private collectionScrapeRepository: Repository<CollectionScrape>,
    @InjectRepository(CollectionCreator)
    private collectionCreatorRepository: Repository<CollectionCreator>,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>
  ) {}

  // ####### Smart Contract Functions

  async createSmartContract(contract_key: string, slug: string) {
    this.logger.log(`[scraping ${slug}] Creating SmartContract...`);
    const smartContractData = {
      contract_key: contract_key,
      type: SmartContractType.non_fungible_tokens,
      chain_id: NEAR_PROTOCOL_DB_ID,
    };

    let smartContract = await this.smartContractRepository.findOneBy({ contract_key });
    if (!smartContract) {
      smartContract = this.smartContractRepository.create();
    }
    this.smartContractRepository.merge(smartContract, smartContractData);
    // this.logger.log("smartContract", JSON.stringify(smartContract, null, 2));
    return await this.smartContractRepository.save(smartContract);
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
    let smartContract = await this.smartContractRepository.findOneBy({ contract_key });
    if (!smartContract) {
      smartContract = this.smartContractRepository.create();
    }
    this.smartContractRepository.merge(smartContract, data);

    return await this.smartContractRepository.save(smartContract);
  }

  // ######## Collection Functions

  async createCollection(smartContractId: string, slug: string) {
    this.logger.log(`[scraping ${slug}] Creating Collection...`);

    let collection = await this.collectionRepository.findOneBy({ slug });
    if (!collection) {
      collection = this.collectionRepository.create({ slug: slug, smart_contract_id: smartContractId });
    }
    return await this.collectionRepository.save(collection);

    // return await this.prismaService.collection.upsert({
    //   where: { slug: slug },
    //   update: {},
    //   create: { slug: slug, smart_contract_id: smartContractId },
    //   select: { id: true },
    // });
  }

  async upsertCollection(slug: string, data: any) {
    let collection = await this.collectionRepository.findOneBy({ slug });

    if (!collection) {
      collection = this.collectionRepository.create();
    }
    this.collectionRepository.merge(collection, data);

    return await this.collectionRepository.save(collection);

    // const loadedCollection = await this.prismaService.collection.upsert({
    //   where: { slug: slug },
    //   update: data,
    //   create: data,
    // });
  }

  // ################################# CollectionScrape Functions

  async createCollectionScrape(collectionId, slug) {
    this.logger.log(`[scraping ${slug}] Creating CollectionScrape...`);

    let collectionScrape = await this.collectionScrapeRepository.findOneBy({ collection_id: collectionId });
    if (!collectionScrape) {
      collectionScrape = this.collectionScrapeRepository.create({ collection_id: collectionId });
    }
    return await this.collectionRepository.save(collectionScrape);

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
    const query = this.collectionScrapeRepository
      .createQueryBuilder()
      .where(
        `stage NOT IN ('${CollectionScrapeStage.getting_tokens}', '${CollectionScrapeStage.done}') AND outcome != '${CollectionScrapeOutcome.failed}'`
      );
    return await query.getCount();
  }

  async updateCollectionScrape(where, data) {
    await this.collectionScrapeRepository.update(where, data);
  }

  async findCollectionScrapeByCollectionId(collection_id) {
    return await this.collectionScrapeRepository.findOneBy({ collection_id });
  }

  async incrementScrapeAttemptByOne(collectionId) {
    await this.collectionScrapeRepository
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
}
