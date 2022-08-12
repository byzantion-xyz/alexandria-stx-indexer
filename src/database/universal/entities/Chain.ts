import { Column, Entity, Index, OneToMany } from "typeorm";
import { CryptoRate } from "./CryptoRate";
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
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("integer")
  format_digits: number;

  @Column("text", { nullable: true })
  coin: string | null;

  @Column("text")
  symbol: string;

  @OneToMany(() => NftMeta, (nftMeta) => nftMeta.chain)
  nft_metas: NftMeta[];

  @OneToMany(() => SmartContract, (smartContract) => smartContract.chain)
  smart_contracts: SmartContract[];

  @OneToMany(() => CryptoRate, (cryptoRate) => cryptoRate.chain)
  crypto_rates: CryptoRate[];

}
