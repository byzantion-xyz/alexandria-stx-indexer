import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { Action } from "./Action";
import { Collection } from "./Collection";
import { CollectionBid } from "./CollectionBid";
import { Commission } from "./Commission";
import { NftMeta } from "./NftMeta";
import { NftState } from "./NftState";
import { Chain } from "./Chain";
import { SmartContractFunction } from "./SmartContractFunction";

@Index("smart_contract_contract_key_key", ["contractKey"], { unique: true })
@Index("smart_contract_pkey", ["id"], { unique: true })
@Entity("smart_contract", { schema: "public" })
export class SmartContract {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  contract_key: string;

  @Column("text", { nullable: true })
  name: string | null;

  @Column("integer", { default: () => "0" })
  scanned_transactions: number;

  @Column("enum", {
    enum: ["non_fungible_tokens", "marketplace", "staking", "fungible_tokens", "bridge", "token_series"],
  })
  type: "non_fungible_tokens" | "marketplace" | "staking" | "fungible_tokens" | "bridge" | "token_series";

  @Column("timestamp without time zone", {
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("text", { nullable: true })
  asset_name: string | null;

  @Column("boolean", { default: () => "false" })
  frozen: boolean;

  @Column("jsonb", { nullable: true })
  json_meta: object | null;

  @Column("text", { nullable: true })
  spec: string | null;

  @Column("text", { nullable: true })
  base_marketplace_uri: string | null;

  @Column("text", { nullable: true })
  collection_uri: string | null;

  @Column("text", { nullable: true })
  token_uri: string | null;

  @OneToMany(() => Action, (action) => action.marketplace_smart_contract)
  marketplace_actions: Action[];

  @OneToMany(() => Action, (action) => action.smart_contract)
  contract_actions: Action[];

  @OneToMany(() => Collection, (collection) => collection.smart_contract)
  collections: Collection[];

  @OneToMany(() => CollectionBid, (collectionBid) => collectionBid.smartContract)
  collection_bids: CollectionBid[];

  @OneToOne(() => Commission, (commission) => commission.smartContract)
  commission: Commission;

  @OneToMany(() => NftMeta, (nftMeta) => nftMeta.smart_contract)
  nft_metas: NftMeta[];

  @OneToMany(() => NftState, (nftState) => nftState.list_contract)
  nft_state: NftState[];

  @ManyToOne(() => Chain, (chain) => chain.smartContracts, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "chain_id", referencedColumnName: "id" }])
  chain: Chain;

  @OneToMany(() => SmartContractFunction, (smartContractFunction) => smartContractFunction.smart_contract)
  smart_contract_functions: SmartContractFunction[];
}
