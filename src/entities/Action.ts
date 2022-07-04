import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Collection } from "./Collection";
import { SmartContract } from "./SmartContract";
import { NftMeta } from "./NftMeta";

@Index("action_pkey", ["id"], { unique: true })
@Entity("action", { schema: "public" })
export class Action {
  @Column("uuid", { primary: true })
  id: string;

  @Column("enum", { enum: ["list", "unlist", "buy"] })
  action: "list" | "unlist" | "buy";

  @Column("jsonb", { nullable: true })
  bid_attribute: object | null;

  @Column("numeric", {
    nullable: true,
    precision: 32,
    scale: 0,
  })
  list_price: bigint;

  @Column("text", { nullable: true })
  seller: string | null;

  @Column("text", { nullable: true })
  buyer: string | null;

  @Column("bigint", { nullable: true })
  bid_price: bigint;

  @Column("bigint")
  block_height: bigint;

  @Column("bigint")
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
}
