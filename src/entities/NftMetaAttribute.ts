import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { NftMeta } from "./NftMeta";

@Index("nft_meta_attribute_pkey", ["id"], { unique: true })
@Index("nft_meta_attribute_meta_id_trait_type_value_key", ["metaId", "traitType", "value"], { unique: true })
@Index("nft_meta_attribute_trait_type_value_idx", ["traitType", "value"], {})
@Entity("nft_meta_attribute", { schema: "public" })
export class NftMetaAttribute {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "trait_type" })
  traitType: string;

  @Column("text", { name: "value" })
  value: string;

  @Column("double precision", {
    name: "rarity",
    precision: 53,
    default: () => "0",
  })
  rarity: number;

  @Column("double precision", {
    name: "score",
    precision: 53,
    default: () => "0",
  })
  score: number;

  @Column("uuid", { name: "meta_id" })
  metaId: string;

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => NftMeta, (nftMeta) => nftMeta.attributes, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;
}
