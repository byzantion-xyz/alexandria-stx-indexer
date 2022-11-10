import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { BidAttribute } from "./BidAttribute";
import { Collection } from "./Collection";

@Index("collection_attribute_collection_id_trait_type_value_key", ["collection_id", "trait_type", "value"], {
  unique: true,
})
@Index("collection_attribute_pkey", ["id"], { unique: true })
@Entity("collection_attribute", { schema: "public" })
export class CollectionAttribute {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  value: string;

  @Column("double precision", { precision: 53 })
  rarity: number;

  @Column("uuid")
  collection_id: string;

  @Column("timestamp without time zone", {
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("text")
  trait_type: string;

  @ManyToOne(() => Collection, (collection) => collection.collection_attributes, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;

  @OneToMany(() => BidAttribute, (bidAttribute) => bidAttribute.collection_attribute, { cascade: true })
  bids: BidAttribute[];
}
