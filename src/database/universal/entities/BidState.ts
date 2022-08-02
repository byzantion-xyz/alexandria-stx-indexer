import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Bid } from "./Bid";
import { NftMeta } from "./NftMeta";

@Index("bid_state_pkey", ["bid_id", "meta_id"], { unique: true })
@Entity("bid_state", { schema: "public" })
export class BidState {
  @PrimaryColumn("uuid")
  bid_id: string;

  @PrimaryColumn("uuid")
  meta_id: string;

  @ManyToOne(() => Bid, (bid) => bid.states, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "bid_id", referencedColumnName: "id" }])
  bid: Bid;

  @ManyToOne(() => NftMeta, (nftMeta) => nftMeta.bid_states, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;
}
