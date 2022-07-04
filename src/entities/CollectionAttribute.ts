import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Collection } from "./Collection";

@Index("collection_attribute_collection_id_trait_type_value_key", ["collectionId", "traitType", "value"], {
  unique: true,
})
@Index("collection_attribute_pkey", ["id"], { unique: true })
@Entity("collection_attribute", { schema: "public" })
export class CollectionAttribute {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "value" })
  value: string;

  @Column("double precision", { name: "rarity", precision: 53 })
  rarity: number;

  @Column("integer", { name: "total" })
  total: number;

  @Column("uuid", { name: "collection_id" })
  collectionId: string;

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @Column("text", { name: "trait_type" })
  traitType: string;

  @ManyToOne(() => Collection, (collection) => collection.collection_attributes, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;
}
