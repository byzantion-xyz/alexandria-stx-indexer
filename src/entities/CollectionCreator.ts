import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { Collection } from "./Collection";

@Index("collection_creator_collection_id_key", ["collectionId"], {
  unique: true,
})
@Index("collection_creator_pkey", ["id"], { unique: true })
@Entity("collection_creator", { schema: "public" })
export class CollectionCreator {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "wallet_id" })
  walletId: string;

  @Column("text", { name: "name", nullable: true })
  name: string | null;

  @Column("text", { name: "bio", nullable: true })
  bio: string | null;

  @Column("text", { name: "twitter", nullable: true })
  twitter: string | null;

  @Column("text", { name: "discord", nullable: true })
  discord: string | null;

  @Column("text", { name: "website", nullable: true })
  website: string | null;

  @Column("uuid", { name: "collection_id" })
  collectionId: string;

  @OneToOne(() => Collection, (collection) => collection.collection_creator, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;
}
