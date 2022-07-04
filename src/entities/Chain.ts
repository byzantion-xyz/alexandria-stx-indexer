import { Column, Entity, Index, OneToMany } from "typeorm";
import { NftMeta } from "./NftMeta";
import { SmartContract } from "./SmartContract";

@Index("chain_pkey", ["id"], { unique: true })
@Index("chain_symbol_key", ["symbol"], { unique: true })
@Entity("chain", { schema: "public" })
export class Chain {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "name" })
  name: string;

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @Column("text", { name: "coin", nullable: true })
  coin: string | null;

  @Column("text", { name: "symbol" })
  symbol: string;

  @OneToMany(() => NftMeta, (nftMeta) => nftMeta.chain)
  nftMetas: NftMeta[];

  @OneToMany(() => SmartContract, (smartContract) => smartContract.chain)
  smartContracts: SmartContract[];
}
