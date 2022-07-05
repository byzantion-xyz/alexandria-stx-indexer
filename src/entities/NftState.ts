import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { SmartContract } from "./SmartContract";
import { NftMeta } from "./NftMeta";

@Index("nft_state_pkey", ["id"], { unique: true })
@Index("nft_state_meta_id_key", ["meta_id"], { unique: true })
@Entity("nft_state", { schema: "public" })
export class NftState {
  @Column("uuid", { primary: true })
  id: string;

  @Column("boolean", { default: () => "false" })
  burned: boolean;

  @Column("boolean", { default: () => "false" })
  minted: boolean;

  @Column("text", { nullable: true })
  mint_tx: string | null;

  @Column("boolean", { default: () => "false" })
  listed: boolean;

  @Column("numeric", {
    nullable: true,
    precision: 32,
    scale: 0,
  })
  list_price: bigint;

  @Column("text", { nullable: true })
  list_seller: string | null;

  @Column("bigint", { nullable: true })
  list_block_height: bigint;

  @Column("bigint", { nullable: true })
  list_tx_index: bigint;

  @Column("boolean", { default: () => "false" })
  asking: boolean;

  @Column("bigint", { nullable: true })
  asking_price: bigint;

  @Column("bigint", { nullable: true })
  asking_block_height: bigint;

  @Column("bigint", { nullable: true })
  asking_tx_index: bigint;

  @Column("text", { nullable: true })
  asking_seller: string | null;

  @Column("boolean", { default: () => "false" })
  bid: boolean;

  @Column("bigint", { nullable: true })
  bid_price: bigint;

  @Column("text", { nullable: true })
  bid_buyer: string | null;

  @Column("text", { nullable: true })
  bid_contract: string | null;

  @Column("bigint", { nullable: true })
  bid_block_height: bigint;

  @Column("bigint", { nullable: true })
  bid_tx_index: bigint;

  @Column("boolean", { default: () => "false" })
  staked: boolean;

  @Column("text", { nullable: true })
  staking_contract: string | null;

  @Column("text", { nullable: true })
  staked_owner: string | null;

  @Column("bigint", { nullable: true })
  stakedBlockHeight: bigint;

  @Column("bigint", { nullable: true })
  staked_block_height: bigint;

  @Column("uuid")
  meta_id: string;

  @Column("timestamp without time zone")
  updated_at: Date;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.nft_state, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "list_contract_id", referencedColumnName: "id" }])
  list_contract: SmartContract;

  @OneToOne(() => NftMeta, (nftMeta) => nftMeta.nft_state, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;
}
