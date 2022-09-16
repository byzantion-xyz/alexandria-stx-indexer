import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { BidState } from "./BidState";
import { CollectionAttribute } from "./CollectionAttribute";

@Index("bid_attribute_pkey", ["bid_id", "collection_attribute_id"], { unique: true })
@Entity("bid_attribute", { schema: "public" })
export class BidAttribute {
  @PrimaryColumn("uuid")
  bid_id: string;

  @PrimaryColumn("uuid")
  collection_attribute_id: string;

  @ManyToOne(() => BidState, (bidState) => bidState.attributes, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "bid_id", referencedColumnName: "id" }])
  bid_state: BidState;

  @ManyToOne(() => CollectionAttribute, (collectionAttribute) => collectionAttribute.bids, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_attribute_id", referencedColumnName: "id" }])
  collection_attribute: CollectionAttribute;
}
