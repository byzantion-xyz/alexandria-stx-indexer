import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { SmartContract } from "./SmartContract";
import { NftMeta } from "./NftMeta";
import { NftStateList } from "./NftStateList";

@Index("nft_state_pkey", ["id"], { unique: true })
@Index("nft_state_meta_id_key", ["meta_id"], { unique: true })
@Entity("nft_state", { schema: "public" })
export class NftState {
  @PrimaryGeneratedColumn("uuid")
  readonly id!: string;

  @Column("boolean", { default: () => "false" })
  burned: boolean;

  @Column("boolean", { default: () => "false" })
  minted: boolean;

  @Column("text", { nullable: true })
  mint_tx: string | null;

  @Column("boolean", { default: () => "false" })
  staked: boolean;

  @Column("text", { nullable: true })
  staked_owner: string | null;

  @Column("bigint", { nullable: true })
  staked_block_height: bigint;

  @Column("bigint", { nullable: true })
  staked_tx_index: bigint;

  @Column("text", { nullable: true })
  owner: string | null;

  @Column("bigint", { nullable: true })
  owner_block_height: bigint;

  @Column("bigint", { nullable: true })
  owner_tx_id: string | null;

  @Column("uuid")
  meta_id: string;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("uuid", { nullable: true })
  staked_contract_id: string;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.staked_nft_states, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "staked_contract_id", referencedColumnName: "id" }])
  staked_contract: SmartContract;

  @OneToOne(() => NftMeta, (nftMeta) => nftMeta.nft_state, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "meta_id", referencedColumnName: "id" }])
  meta: NftMeta;

  @OneToMany(() => NftStateList, (nftStateList) => nftStateList.nft_state, { cascade: true })
  nft_states_list: NftStateList[];
}
