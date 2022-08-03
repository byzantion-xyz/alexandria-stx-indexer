import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { BidAttribute } from "./BidAttribute";
import { BidState } from "./BidState";
import { SmartContract } from "./SmartContract";

@Index("bid_pkey", ["id"], { unique: true })
@Entity("bid", { schema: "public" })
export class Bid {
  @Column("uuid", { primary: true })
  id: string;

  @Column("integer")
  nonce: number;

  @Column("text")
  bid_contract_nonce: string;

  @Column("text")
  bid_buyer: string;

  @Column("text")
  bid_seller: string;

  @Column("enum", { enum: ["active", "pending", "cancelled", "matched"], default: () => "active" })
  status: "active" | "pending" | "cancelled" | "matched";

  @Column("text", { nullable: true, array: true })
  pending_txs: string[] | null;

  @Column("text")
  pending_tx: string;

  @Column("text")
  tx_id: string;

  @Column("bigint")
  block_height: string;

  @Column("text")
  match_tx_id: string;

  @Column("text")
  cancel_tx_id: string;

  @Column("enum", { enum: ["collection", "attribute", "solo"] })
  bid_type: "collection" | "attribute" | "solo";

  @Column("timestamp without time zone", { default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("bigint")
  bid_price: bigint;

  @Column("uuid")
  smart_contract_id: string;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.collection_bids, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smart_contract: SmartContract;

  @OneToMany(
    () => BidState,
    (bidState) => bidState.bid,
    { cascade: true }
  )
  states: BidState[];

  @OneToMany(
    () => BidAttribute,
    (bidAttribute) => bidAttribute.bid,
    { cascade: true }
  )
  attributes: BidAttribute[];
}