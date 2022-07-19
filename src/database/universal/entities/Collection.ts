import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { Action } from "./Action";
import { CollectionScrape } from "./CollectionScrape";
import { SmartContract } from "./SmartContract";
import { CollectionAttribute } from "./CollectionAttribute";
import { CollectionCreator } from "./CollectionCreator";
import { CollectionOnDiscordServerChannel } from "./CollectionOnDiscordServerChannel";
import { NftMeta } from "./NftMeta";

@Index("collection_collection_scrape_id_key", ["collection_scrape_id"], {
  unique: true,
})
@Index("collection_pkey", ["id"], { unique: true })
@Index("collection_slug_key", ["slug"], { unique: true })
@Entity("collection", { schema: "public" })
export class Collection {
  @Column("uuid", { primary: true })
  id: string;

  @Column({type: "numeric", precision: 14, nullable: true})
  collection_size: number | null;

  @Column("text", { nullable: true })
  description: string | null;

  @Column("text", { nullable: true })
  external_url: string | null;

  @Column({type: "numeric", precision: 14, default: 0})
  volume: number;

  @Column("integer", { default: () => "0" })
  floor: number;

  @Column("text", { nullable: true })
  cover_image: string | null;

  @Column("boolean", { default: () => "false" })
  trending: boolean;

  @Column("text", { nullable: true })
  title: string | null;

  @Column("timestamp without time zone", {
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("text", { nullable: true })
  slug: string | null;

  @Column("uuid", { nullable: true })
  collection_scrape_id: string | null;

  @OneToMany(() => Action, (action) => action.collection)
  actions: Action[];

  @OneToOne(() => CollectionScrape, (collectionScrape) => collectionScrape.collection, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_scrape_id", referencedColumnName: "id" }])
  collection_scrape: CollectionScrape;

  @Column()
  smart_contract_id: string;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.collections, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smart_contract: SmartContract;

  @OneToMany(() => CollectionAttribute, (collectionAttribute) => collectionAttribute.collection)
  collection_attributes: CollectionAttribute[];

  @OneToOne(() => CollectionCreator, (collectionCreator) => collectionCreator.collection)
  collection_creator: CollectionCreator;

  @OneToMany(
    () => CollectionOnDiscordServerChannel,
    (collectionOnDiscordServerChannel) => collectionOnDiscordServerChannel.collection
  )
  collection_on_discord_server_channels: CollectionOnDiscordServerChannel[];

  @OneToMany(() => NftMeta, (nftMeta) => nftMeta.collection)
  nft_metas: NftMeta[];
}
