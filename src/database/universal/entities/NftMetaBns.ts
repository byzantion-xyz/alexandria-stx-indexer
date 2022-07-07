import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { NftMeta } from "./NftMeta";

@Index("nft_meta_bns_pkey", ["id"], { unique: true })
@Index("nft_meta_bns_meta_id_key", ["meta_id"], { unique: true })
@Entity("nft_meta_bns", { schema: "public" })
export class NftMetaBns {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  name: string;

  @Column("text")
  namespace: string;

  @Column("uuid")
  meta_id: string;

  @OneToOne(() => NftMeta, (nftMeta) => nftMeta.nft_meta_bns, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;
}
