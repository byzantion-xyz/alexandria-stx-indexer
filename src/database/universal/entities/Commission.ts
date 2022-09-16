import { Column, Entity, Index, JoinColumn, OneToMany, OneToOne } from "typeorm";
import { Action } from "./Action";
import { NftState } from "./NftState";
import { NftStateList } from "./NftStateList";
import { SmartContract } from "./SmartContract";

@Index("commission_commission_key_key", ["commission_key"], { unique: true })
@Index("commission_pkey", ["id"], { unique: true })
@Entity("commission", { schema: "public" })
export class Commission {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  commission_key: string;

  @Column("boolean")
  custodial: boolean;

  @Column("float4", { default: 0 })
  commission: number;

  @Column("float4", { default: 0 })
  royalty: number;

  @Column("integer", { nullable: true })
  amount: number | null;

  @Column("uuid")
  smart_contract_id: string;

  @Column({ length: 64 })
  market_name: string;

  @Column("timestamp without time zone", {
    default: "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone", {
    default: "CURRENT_TIMESTAMP",
  })
  updated_at: Date;

  @OneToOne(() => SmartContract, (smartContract) => smartContract.commission, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smart_contract: SmartContract;

  @OneToMany(() => NftStateList, (nftStateList) => nftStateList.commission)
  nft_states_list: NftStateList[];

  @OneToMany(() => Action, (action) => action.commission)
  actions: Action[];

  @OneToOne(() => NftState, (nftState) => nftState.meta)
  default_for_smart_contract: SmartContract;
}
