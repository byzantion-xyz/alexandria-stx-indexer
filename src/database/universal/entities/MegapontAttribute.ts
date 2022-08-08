import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { NftMetaAttribute } from "./NftMetaAttribute";

@Index("megapont_attribute_pkey", ["id"], { unique: true })
@Index("megapont_attribute_nft_meta_attribute_id_key", ["nft_meta_attribute_id"], { unique: true })
@Entity("megapont_attribute", { schema: "public" })
export class MegapontAttribute {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text")
  trait_group: string;

  @Column("text")
  sequence: string;

  @Column("text")
  token_id: string;

  @Column("uuid")
  nft_meta_attribute_id: string;

  @OneToOne(() => NftMetaAttribute, (nftMetaAttribute) => nftMetaAttribute.megapont_attribute, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "nft_meta_attribute_id", referencedColumnName: "id" }])
  nft_meta_attribute: NftMetaAttribute;
}
