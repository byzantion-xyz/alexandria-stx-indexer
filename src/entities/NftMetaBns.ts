import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { NftMeta } from "./NftMeta";

@Index("nft_meta_bns_pkey", ["id"], { unique: true })
@Index("nft_meta_bns_meta_id_key", ["metaId"], { unique: true })
@Entity("nft_meta_bns", { schema: "public" })
export class NftMetaBns {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "name" })
  name: string;

  @Column("text", { name: "namespace" })
  namespace: string;

  @Column("uuid", { name: "meta_id" })
  metaId: string;

  @OneToOne(() => NftMeta, (nftMeta) => nftMeta.nftMetaBns, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;
}
