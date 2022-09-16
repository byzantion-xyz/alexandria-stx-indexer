import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { SmartContract } from "./SmartContract";
import { Commission } from "./Commission";
import { NftState } from "./NftState";

@Index("nft_state_list_nft_state_id_list_contract_id_key", ["nft_state_id", "list_contract_id"], { unique: true })
@Entity("nft_state_list", { schema: "public" })
export class NftStateList {
  @PrimaryGeneratedColumn("uuid")
  readonly id: string;

  @Column("boolean", { default: "false" })
  listed: boolean;

  @Column("numeric", { nullable: true, precision: 40, scale: 0 })
  list_price: bigint;

  @Column("text", { nullable: true })
  list_seller: string | null;

  @Column("bigint", { nullable: true })
  list_block_height: bigint;

  @Column("timestamp without time zone", { nullable: true })
  list_block_datetime: Date;

  @Column("bigint", { nullable: true })
  list_tx_index: bigint;

  @Column("bigint", { nullable: true })
  list_sub_block_seq: bigint;

  @Column("jsonb", { nullable: true })
  function_args: object | null;

  @Column("uuid", { nullable: true })
  list_contract_id: string;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.nft_states_list, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "list_contract_id", referencedColumnName: "id" }])
  list_contract: SmartContract;

  @Column("uuid", { nullable: true })
  commission_id: string;

  @ManyToOne(() => Commission, (commission) => commission.nft_states_list, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "commission_id", referencedColumnName: "id" }])
  commission: Commission;

  @Column("uuid", { nullable: true })
  nft_state_id: string;

  @ManyToOne(() => NftState, (nftState) => nftState.nft_states_list, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "nft_state_id", referencedColumnName: "id" }])
  nft_state: SmartContract;
}
