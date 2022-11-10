import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Collection } from "./Collection";
import { SmartContract } from "./SmartContract";
import { NftMeta } from "./NftMeta";
import { Commission } from "./Commission";

export enum ActionName {
  list = "list",
  unlist = "unlist",
  buy = "buy",
  accept_collection_bid = "accept-collection-bid",
  accept_attribute_bid = "accept-attribute-bid",
  accept_bid = "accept-bid",
  asking_price = "asking-price",
  attribute_bid = "attribute-bid",
  bid = "bid",
  cancel_attribute_bid = "cancel-attribute-bid",
  cancel_collection_bid = "cancel-collection-bid",
  collection_bid = "collection-bid",
  mint = "mint",
  multi_attribute_bid = "multi-attribute-bid",
  multi_collection_bid = "multi-collection-bid",
  relist = "relist",
  stake = "stake",
  transfer = "transfer",
  unlist_bid = "unlist-bid",
  unlist_collection_bid = "unlist-collection-bid",
  unstake = "unstake",
  solo_bid = "solo-bid",
  burn = "burn",
  reset_owner = "reset-owner",
}

@Index("action_pkey", ["id"], { unique: true })
@Entity("action", { schema: "public" })
export class Action {
  @PrimaryGeneratedColumn("uuid")
  readonly id: string;

  @Column({
    type: "enum",
    enum: ActionName,
  })
  action: ActionName;

  @Column("jsonb", { nullable: true })
  bid_attribute: object | null;

  @Column("numeric", {
    nullable: true,
    precision: 40,
    scale: 0,
  })
  list_price: bigint;

  @Column("text", { nullable: true })
  seller: string | null;

  @Column("text", { nullable: true })
  buyer: string | null;

  @Column("numeric", {
    nullable: true,
    precision: 40,
    scale: 0,
  })
  bid_price: bigint;

  @Column("bigint")
  block_height: bigint;

  @Column("bigint", { nullable: true })
  tx_index: bigint;

  @Column("timestamp without time zone")
  block_time: Date;

  @Column("text")
  tx_id: string;

  @Column("boolean", { default: () => "false" })
  segment: boolean;

  @Column("text", { nullable: true })
  market_name: string | null;

  @Column("bigint", { nullable: true })
  nonce: bigint;

  @Column("integer", { nullable: true })
  units: number | null;

  @Column()
  collection_id: string;

  @ManyToOne(() => Collection, (collection) => collection.actions, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;

  @Column()
  marketplace_smart_contract_id: string;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.marketplace_actions, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "marketplace_smart_contract_id", referencedColumnName: "id" }])
  marketplace_smart_contract: SmartContract;

  @Column()
  nft_meta_id: string;

  @ManyToOne(() => NftMeta, (nftMeta) => nftMeta.actions, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "nft_meta_id", referencedColumnName: "id" }])
  nft_meta: NftMeta;

  @Column()
  smart_contract_id: string;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.contract_actions, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smart_contract: SmartContract;

  @Column("uuid")
  commission_id: string;

  @ManyToOne(() => Commission, (commission) => commission.actions, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "commission_id", referencedColumnName: "id" }])
  commission: Commission;
}
