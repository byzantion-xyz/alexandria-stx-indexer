import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { BidState } from "./BidState";
import { NftMeta } from "./NftMeta";

@Index("bid_state_nft_meta_pkey", ["bid_id", "meta_id"], { unique: true })
@Entity("bid_state_nft_meta", { schema: "public" })
export class BidStateNftMeta {
  @PrimaryColumn("uuid")
  bid_id: string;

  @PrimaryColumn("uuid")
  meta_id: string;

  @ManyToOne(() => BidState, (bidState) => bidState.nft_metas, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "bid_id", referencedColumnName: "id" }])
  bid_state: BidState;

  @ManyToOne(() => NftMeta, (nftMeta) => nftMeta.bid_states, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;
}
