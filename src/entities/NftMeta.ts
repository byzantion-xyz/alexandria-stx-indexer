import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { Action } from "./Action";
import { Chain } from "./Chain";
import { Collection } from "./Collection";
import { SmartContract } from "./SmartContract";
import { NftMetaAttribute } from "./NftMetaAttribute";
import { NftMetaBns } from "./NftMetaBns";
import { NftState } from "./NftState";

@Index("nft_meta_collection_id_token_id_key", ["collectionId", "tokenId"], {
  unique: true,
})
@Index("nft_meta_pkey", ["id"], { unique: true })
@Entity("nft_meta", { schema: "public" })
export class NftMeta {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  uuid: string;

  @Column("text")
  name: string;

  @Column("text", { nullable: true })
  namespace: string | null;

  @Column("text")
  image: string;

  @Column("text")
  token_id: string;

  @Column("double precision", { nullable: true, precision: 53 })
  rarity: number | null;

  @Column("integer")
  ranking: number;

  @Column("text", { nullable: true })
  asset_name: string | null;

  @Column("text", { nullable: true })
  grouping: string | null;

  @Column("uuid", { nullable: true })
  collection_id: string | null;

  @Column("timestamp without time zone", {
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("jsonb", { nullable: true })
  json_meta: object | null;

  @OneToMany(() => Action, (action) => action.nft_meta)
  actions: Action[];

  @ManyToOne(() => Chain, (chain) => chain.nft_metas, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "chain_id", referencedColumnName: "id" }])
  chain: Chain;

  @ManyToOne(() => Collection, (collection) => collection.nft_metas, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.nft_metas, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smart_contract: SmartContract;

  @OneToMany(() => NftMetaAttribute, (nftMetaAttribute) => nftMetaAttribute.meta)
  attributes: NftMetaAttribute[];

  @OneToOne(() => NftMetaBns, (nftMetaBns) => nftMetaBns.meta)
  nft_meta_bns: NftMetaBns;

  @OneToOne(() => NftState, (nftState) => nftState.meta)
  nft_state: NftState;
}
