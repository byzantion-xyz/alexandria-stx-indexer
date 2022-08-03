import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Bid } from "./Bid";
import { CollectionAttribute } from "./CollectionAttribute";
import { NftMeta } from "./NftMeta";

@Index("bid_attribute_pkey", ["bid_id", "collection_attribute_id"], { unique: true })
@Entity("bid_attribute", { schema: "public" })
export class BidAttribute {
  @PrimaryColumn("uuid")
  bid_id: string;

  @PrimaryColumn("uuid")
  collection_attribute_id: string;

  @ManyToOne(() => Bid, (bid) => bid.states, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "bid_id", referencedColumnName: "id" }])
  bid: Bid;

  @ManyToOne(() => CollectionAttribute, (collectionAttribute) => collectionAttribute.bids, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_attribute_id", referencedColumnName: "id" }])
  collection_attribute: CollectionAttribute;
}
