import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Collection } from "./Collection";
import { SmartContract } from "./SmartContract";
import { NftMeta } from "./NftMeta";

@Index("action_pkey", ["id"], { unique: true })
@Entity("action", { schema: "public" })
export class Action {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("enum", { name: "action", enum: ["list", "unlist", "buy"] })
  action: "list" | "unlist" | "buy";

  @Column("jsonb", { name: "bid_attribute", nullable: true })
  bidAttribute: object | null;

  @Column("numeric", {
    name: "list_price",
    nullable: true,
    precision: 32,
    scale: 0,
  })
  listPrice: string | null;

  @Column("text", { name: "seller", nullable: true })
  seller: string | null;

  @Column("text", { name: "buyer", nullable: true })
  buyer: string | null;

  @Column("bigint", { name: "bid_price", nullable: true })
  bidPrice: string | null;

  @Column("bigint", { name: "block_height" })
  blockHeight: string;

  @Column("bigint", { name: "tx_index" })
  txIndex: string;

  @Column("timestamp without time zone", { name: "block_time" })
  blockTime: Date;

  @Column("text", { name: "tx_id" })
  txId: string;

  @Column("boolean", { name: "segment", default: () => "false" })
  segment: boolean;

  @Column("text", { name: "market_name", nullable: true })
  marketName: string | null;

  @Column("bigint", { name: "nonce", nullable: true })
  nonce: string | null;

  @Column("integer", { name: "units", nullable: true })
  units: number | null;

  @ManyToOne(() => Collection, (collection) => collection.actions, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.marketplaceActions, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "marketplace_smart_contract_id", referencedColumnName: "id" }])
  marketplaceSmartContract: SmartContract;

  @ManyToOne(() => NftMeta, (nftMeta) => nftMeta.actions, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "nft_meta_id", referencedColumnName: "id" }])
  nftMeta: NftMeta;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.contractActions, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smartContract: SmartContract;
}
