import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Action } from "./Action";
import { Chain } from "./Chain";
import { Collection } from "./Collection";
import { SmartContract } from "./SmartContract";
import { NftMetaAttribute } from "./NftMetaAttribute";
import { NftMetaBns } from "./NftMetaBns";
import { NftState } from "./NftState";
import { BidStateNftMeta } from "./BidStateNftMeta";
import { BidState } from "./BidState";

@Index("nft_meta_collection_id_token_id_key", ["collection_id", "token_id"], {
  unique: true,
})
@Index("nft_meta_pkey", ["id"], { unique: true })
@Entity("nft_meta", { schema: "public" })
export class NftMeta {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text")
  uuid: string;

  @Column("text")
  name: string;

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

  @Column("boolean", { default: () => "false" })
  chain_locked: boolean;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("jsonb", { nullable: true })
  json_meta: object | null;

  @OneToMany(() => Action, (action) => action.nft_meta)
  actions: Action[];

  @Column()
  chain_id: string;

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

  @Column()
  smart_contract_id: string;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.nft_metas, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smart_contract: SmartContract;

  @OneToMany(() => NftMetaAttribute, (nftMetaAttribute) => nftMetaAttribute.meta, { cascade: true })
  attributes: NftMetaAttribute[];

  @OneToOne(() => NftMetaBns, (nftMetaBns) => nftMetaBns.meta)
  nft_meta_bns: NftMetaBns;

  @OneToOne(() => NftState, (nftState) => nftState.meta)
  nft_state: NftState;

  @OneToMany(
    () => BidStateNftMeta,
    (bidState) => bidState.meta,
    { cascade: true }
  )
  bid_states: BidStateNftMeta[];
}
