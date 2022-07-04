import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { SmartContract } from "./SmartContract";

@Index("collection_bid_pkey", ["id"], { unique: true })
@Entity("collection_bid", { schema: "public" })
export class CollectionBid {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "token_id" })
  tokenId: string;

  @Column("text", { name: "token_id_list", nullable: true, array: true })
  tokenIdList: string[] | null;

  @Column("integer", { name: "nonce" })
  nonce: number;

  @Column("text", { name: "bid_contract_nonce" })
  bidContractNonce: string;

  @Column("text", { name: "bid_buyer" })
  bidBuyer: string;

  @Column("text", { name: "bid_seller" })
  bidSeller: string;

  @Column("enum", { name: "status", enum: ["active", "pending", "cancelled", "matched"], default: () => "active" })
  status: "active" | "pending" | "cancelled" | "matched";

  @Column("text", { name: "pending_txs", nullable: true, array: true })
  pendingTxs: string[] | null;

  @Column("text", { name: "pending_tx" })
  pendingTx: string;

  @Column("text", { name: "tx_id" })
  txId: string;

  @Column("bigint", { name: "block_height" })
  blockHeight: string;

  @Column("text", { name: "match_tx_id" })
  matchTxId: string;

  @Column("text", { name: "cancel_tx_id" })
  cancelTxId: string;

  @Column("enum", { name: "bid_type", enum: ["collection", "attribute", "solo"] })
  bidType: "collection" | "attribute" | "solo";

  @Column("timestamp without time zone", { name: "created_at", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @Column("bigint", { name: "bid_price" })
  bidPrice: string;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.collection_bids, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smartContract: SmartContract;
}
