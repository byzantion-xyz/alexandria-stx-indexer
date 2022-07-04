import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from "typeorm";
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
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "uuid" })
  uuid: string;

  @Column("text", { name: "name" })
  name: string;

  @Column("text", { name: "namespace", nullable: true })
  namespace: string | null;

  @Column("text", { name: "image" })
  image: string;

  @Column("text", { name: "token_id" })
  tokenId: string;

  @Column("double precision", { name: "rarity", nullable: true, precision: 53 })
  rarity: number | null;

  @Column("integer", { name: "ranking" })
  ranking: number;

  @Column("text", { name: "asset_name", nullable: true })
  assetName: string | null;

  @Column("text", { name: "grouping", nullable: true })
  grouping: string | null;

  @Column("uuid", { name: "collection_id", nullable: true })
  collectionId: string | null;

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @Column("jsonb", { name: "json_meta", nullable: true })
  jsonMeta: object | null;

  @OneToMany(() => Action, (action) => action.nftMeta)
  actions: Action[];

  @ManyToOne(() => Chain, (chain) => chain.nftMetas, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "chain_id", referencedColumnName: "id" }])
  chain: Chain;

  @ManyToOne(() => Collection, (collection) => collection.nftMetas, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.nftMetas, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smartContract: SmartContract;

  @OneToMany(
    () => NftMetaAttribute,
    (nftMetaAttribute) => nftMetaAttribute.meta
  )
  nftMetaAttributes: NftMetaAttribute[];

  @OneToOne(() => NftMetaBns, (nftMetaBns) => nftMetaBns.meta)
  nftMetaBns: NftMetaBns;

  @OneToOne(() => NftState, (nftState) => nftState.meta)
  nftState: NftState;
}
