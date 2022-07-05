import { Column, Entity, Index, OneToOne } from "typeorm";
import { Collection } from "./Collection";

@Index("collection_scrape_collection_id_key", ["collection_id"], { unique: true })
@Index("collection_scrape_pkey", ["id"], { unique: true })
@Entity("collection_scrape", { schema: "public" })
export class CollectionScrape {
  @Column("uuid", { primary: true })
  id: string;

  @Column("enum", {
    nullable: true,
    enum: [
      "getting_tokens",
      "pinning_folder",
      "loading_nft_metas",
      "updating_rarities",
      "creating_collection_attributes",
      "pinning_multiple_images",
      "done",
    ],
    default: () => "'getting_tokens'",
  })
  stage:
    | "getting_tokens"
    | "pinning_folder"
    | "loading_nft_metas"
    | "updating_rarities"
    | "creating_collection_attributes"
    | "pinning_multiple_images"
    | "done"
    | null;

  @Column("enum", { nullable: true, enum: ["skipped", "succeeded", "failed"] })
  outcome: "skipped" | "succeeded" | "failed" | null;

  @Column("text", { nullable: true })
  outcomeMsg: string | null;

  @Column("jsonb", { nullable: true })
  error: object | null;

  @Column("uuid")
  collection_id: string;

  @Column("integer", { default: () => "0" })
  attempts: number;

  @OneToOne(() => Collection, (collection) => collection.collection_scrape)
  collection: Collection;
}
