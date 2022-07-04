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
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "contract_key" })
  contractKey: string;

  @Column("text", { name: "name", nullable: true })
  name: string | null;

  @Column("integer", { name: "scanned_transactions", default: () => "0" })
  scannedTransactions: number;

  @Column("enum", {
    name: "type",
    enum: ["non_fungible_tokens", "marketplace", "staking", "fungible_tokens", "bridge", "token_series"],
  })
  type: "non_fungible_tokens" | "marketplace" | "staking" | "fungible_tokens" | "bridge" | "token_series";

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @Column("text", { name: "asset_name", nullable: true })
  assetName: string | null;

  @Column("boolean", { name: "frozen", default: () => "false" })
  frozen: boolean;

  @Column("jsonb", { name: "json_meta", nullable: true })
  jsonMeta: object | null;

  @Column("text", { name: "spec", nullable: true })
  spec: string | null;

  @Column("text", { name: "base_marketplace_uri", nullable: true })
  baseMarketplaceUri: string | null;

  @Column("text", { name: "collection_uri", nullable: true })
  collectionUri: string | null;

  @Column("text", { name: "token_uri", nullable: true })
  tokenUri: string | null;

  @OneToMany(() => Action, (action) => action.marketplaceSmartContract)
  marketplaceActions: Action[];

  @OneToMany(() => Action, (action) => action.smartContract)
  contractActions: Action[];

  @OneToMany(() => Collection, (collection) => collection.smartContract)
  collections: Collection[];

  @OneToMany(() => CollectionBid, (collectionBid) => collectionBid.smartContract)
  collectionBids: CollectionBid[];

  @OneToOne(() => Commission, (commission) => commission.smartContract)
  commission: Commission;

  @OneToMany(() => NftMeta, (nftMeta) => nftMeta.smartContract)
  nftMetas: NftMeta[];

  @OneToMany(() => NftState, (nftState) => nftState.listContract)
  nftStates: NftState[];

  @ManyToOne(() => Chain, (chain) => chain.smartContracts, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "chain_id", referencedColumnName: "id" }])
  chain: Chain;

  @OneToMany(() => SmartContractFunction, (smartContractFunction) => smartContractFunction.smartContract)
  smartContractFunctions: SmartContractFunction[];
}
