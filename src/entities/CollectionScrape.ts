import { Column, Entity, Index, OneToOne } from "typeorm";
import { Collection } from "./Collection";

@Index("collection_scrape_collection_id_key", ["collectionId"], { unique: true })
@Index("collection_scrape_pkey", ["id"], { unique: true })
@Entity("collection_scrape", { schema: "public" })
export class CollectionScrape {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("enum", {
    name: "stage",
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

  @Column("enum", { name: "outcome", nullable: true, enum: ["skipped", "succeeded", "failed"] })
  outcome: "skipped" | "succeeded" | "failed" | null;

  @Column("text", { name: "outcome_msg", nullable: true })
  outcomeMsg: string | null;

  @Column("jsonb", { name: "error", nullable: true })
  error: object | null;

  @Column("uuid", { name: "collection_id" })
  collectionId: string;

  @Column("integer", { name: "attempts", default: () => "0" })
  attempts: number;

  @OneToOne(() => Collection, (collection) => collection.collectionScrape)
  collection: Collection;
}
