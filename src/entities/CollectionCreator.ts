import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { Collection } from "./Collection";

@Index("collection_creator_collection_id_key", ["collection_id"], {
  unique: true,
})
@Index("collection_creator_pkey", ["id"], { unique: true })
@Entity("collection_creator", { schema: "public" })
export class CollectionCreator {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  wallet_id: string;

  @Column("text", { nullable: true })
  name: string | null;

  @Column("text", { nullable: true })
  bio: string | null;

  @Column("text", { nullable: true })
  twitter: string | null;

  @Column("text", { nullable: true })
  discord: string | null;

  @Column("text", { nullable: true })
  website: string | null;

  @Column("uuid")
  collection_id: string;

  @OneToOne(() => Collection, (collection) => collection.collection_creator, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;
}
