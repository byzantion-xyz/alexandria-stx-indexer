import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from "typeorm";
import { Action } from "./Action";
import { CollectionScrape } from "./CollectionScrape";
import { SmartContract } from "./SmartContract";
import { CollectionAttribute } from "./CollectionAttribute";
import { CollectionCreator } from "./CollectionCreator";
import { CollectionOnDiscordServerChannel } from "./CollectionOnDiscordServerChannel";
import { NftMeta } from "./NftMeta";

@Index("collection_collection_scrape_id_key", ["collectionScrapeId"], {
  unique: true,
})
@Index("collection_pkey", ["id"], { unique: true })
@Index("collection_slug_key", ["slug"], { unique: true })
@Entity("collection", { schema: "public" })
export class Collection {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("integer", { name: "collection_size", nullable: true })
  collectionSize: number | null;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @Column("text", { name: "external_url", nullable: true })
  externalUrl: string | null;

  @Column("integer", { name: "volume", default: () => "0" })
  volume: number;

  @Column("integer", { name: "floor", default: () => "0" })
  floor: number;

  @Column("text", { name: "cover_image", nullable: true })
  coverImage: string | null;

  @Column("boolean", { name: "trending", default: () => "false" })
  trending: boolean;

  @Column("text", { name: "title", nullable: true })
  title: string | null;

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @Column("text", { name: "slug", nullable: true })
  slug: string | null;

  @Column("uuid", { name: "collection_scrape_id", nullable: true })
  collectionScrapeId: string | null;

  @OneToMany(() => Action, (action) => action.collection)
  actions: Action[];

  @OneToOne(
    () => CollectionScrape,
    (collectionScrape) => collectionScrape.collection,
    { onDelete: "SET NULL", onUpdate: "CASCADE" }
  )
  @JoinColumn([{ name: "collection_scrape_id", referencedColumnName: "id" }])
  collectionScrape: CollectionScrape;

  @ManyToOne(
    () => SmartContract,
    (smartContract) => smartContract.collections,
    { onDelete: "SET NULL", onUpdate: "CASCADE" }
  )
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smartContract: SmartContract;

  @OneToMany(
    () => CollectionAttribute,
    (collectionAttribute) => collectionAttribute.collection
  )
  collectionAttributes: CollectionAttribute[];

  @OneToOne(
    () => CollectionCreator,
    (collectionCreator) => collectionCreator.collection
  )
  collectionCreator: CollectionCreator;

  @OneToMany(
    () => CollectionOnDiscordServerChannel,
    (collectionOnDiscordServerChannel) =>
      collectionOnDiscordServerChannel.collection
  )
  collectionOnDiscordServerChannels: CollectionOnDiscordServerChannel[];

  @OneToMany(() => NftMeta, (nftMeta) => nftMeta.collection)
  nftMetas: NftMeta[];
}
