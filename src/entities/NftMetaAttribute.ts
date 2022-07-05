import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { NftMeta } from "./NftMeta";

@Index("nft_meta_attribute_pkey", ["id"], { unique: true })
@Index("nft_meta_attribute_meta_id_trait_type_value_key", ["metaId", "traitType", "value"], { unique: true })
@Index("nft_meta_attribute_trait_type_value_idx", ["traitType", "value"], {})
@Entity("nft_meta_attribute", { schema: "public" })
export class NftMetaAttribute {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  trait_type: string;

  @Column("text")
  value: string;

  @Column("double precision", {
    precision: 53,
    default: () => "0",
  })
  rarity: number;

  @Column("double precision", {
    precision: 53,
    default: () => "0",
  })
  score: number;

  @Column("uuid")
  meta_id: string;

  @Column("timestamp without time zone", {
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @ManyToOne(() => NftMeta, (nftMeta) => nftMeta.attributes, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;
}
