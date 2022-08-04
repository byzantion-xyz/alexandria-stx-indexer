import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Action } from "./Action";
import { Collection } from "./Collection";
import { BidState } from "./BidState";
import { Commission } from "./Commission";
import { NftMeta } from "./NftMeta";
import { NftState } from "./NftState";
import { Chain } from "./Chain";
import { SmartContractFunction } from "./SmartContractFunction";
import { SmartContractType } from "src/indexers/common/helpers/indexer-enums";

@Index("smart_contract_contract_key_key", ["contract_key"], { unique: true })
@Index("smart_contract_pkey", ["id"], { unique: true })
@Entity("smart_contract", { schema: "public" })
export class SmartContract {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text")
  contract_key: string;

  @Column("text")
  contract_key_wrapper: string;

  @Column("text", { nullable: true })
  name: string | null;

  @Column("integer", { default: () => "0" })
  scanned_transactions: number;

  @Column({
    type: "enum",
    enum: SmartContractType,
    array: true
  })
  type: SmartContractType[];

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

  @OneToMany(() => BidState, (bidState) => bidState.smart_contract)
  bid_states: BidState[];

  @OneToMany(() => Commission, (commission) => commission.smart_contract)
  commission: Commission[];

  @OneToMany(() => NftMeta, (nftMeta) => nftMeta.smart_contract)
  nft_metas: NftMeta[];

  @OneToMany(() => NftState, (nftState) => nftState.list_contract)
  nft_state: NftState[];

  @Column()
  chain_id: string;

  @ManyToOne(() => Chain, (chain) => chain.smart_contracts, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "chain_id", referencedColumnName: "id" }])
  chain: Chain;

  @OneToMany(() => SmartContractFunction, (smartContractFunction) => smartContractFunction.smart_contract)
  smart_contract_functions: SmartContractFunction[];

  @Column("uuid")
  default_commission_id: string;

  @OneToOne(() => Commission, (commission) => commission.default_for_smart_contract, {
    nullable: true,
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "default_commission_id", referencedColumnName: "id" }])
  default_commission: Commission;
}
