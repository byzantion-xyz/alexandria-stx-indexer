import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from "typeorm";
import { SmartContract } from "./SmartContract";
import { NftMeta } from "./NftMeta";

@Index("nft_state_pkey", ["id"], { unique: true })
@Index("nft_state_meta_id_key", ["metaId"], { unique: true })
@Entity("nft_state", { schema: "public" })
export class NftState {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("boolean", { name: "burned", default: () => "false" })
  burned: boolean;

  @Column("boolean", { name: "minted", default: () => "false" })
  minted: boolean;

  @Column("text", { name: "mint_tx", nullable: true })
  mintTx: string | null;

  @Column("boolean", { name: "listed", default: () => "false" })
  listed: boolean;

  @Column("numeric", {
    name: "list_price",
    nullable: true,
    precision: 32,
    scale: 0,
  })
  listPrice: string | null;

  @Column("text", { name: "list_seller", nullable: true })
  listSeller: string | null;

  @Column("bigint", { name: "list_block_height", nullable: true })
  listBlockHeight: string | null;

  @Column("bigint", { name: "list_tx_index", nullable: true })
  listTxIndex: string | null;

  @Column("boolean", { name: "asking", default: () => "false" })
  asking: boolean;

  @Column("bigint", { name: "asking_price", nullable: true })
  askingPrice: string | null;

  @Column("bigint", { name: "asking_block_height", nullable: true })
  askingBlockHeight: string | null;

  @Column("bigint", { name: "asking_tx_index", nullable: true })
  askingTxIndex: string | null;

  @Column("text", { name: "asking_seller", nullable: true })
  askingSeller: string | null;

  @Column("boolean", { name: "bid", default: () => "false" })
  bid: boolean;

  @Column("bigint", { name: "bid_price", nullable: true })
  bidPrice: string | null;

  @Column("text", { name: "bid_buyer", nullable: true })
  bidBuyer: string | null;

  @Column("text", { name: "bid_contract", nullable: true })
  bidContract: string | null;

  @Column("bigint", { name: "bid_block_height", nullable: true })
  bidBlockHeight: string | null;

  @Column("bigint", { name: "bid_tx_index", nullable: true })
  bidTxIndex: string | null;

  @Column("boolean", { name: "staked", default: () => "false" })
  staked: boolean;

  @Column("text", { name: "staking_contract", nullable: true })
  stakingContract: string | null;

  @Column("text", { name: "staked_owner", nullable: true })
  stakedOwner: string | null;

  @Column("bigint", { name: "staked_block_height", nullable: true })
  stakedBlockHeight: string | null;

  @Column("bigint", { name: "staked_tx_index", nullable: true })
  stakedTxIndex: string | null;

  @Column("uuid", { name: "meta_id" })
  metaId: string;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.nftStates, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "list_contract_id", referencedColumnName: "id" }])
  listContract: SmartContract;

  @OneToOne(() => NftMeta, (nftMeta) => nftMeta.nftState, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;
}
