import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Chain } from "./Chain";

@Index("crypto_rates_uk_fiat_crypto", ["crypto_currency", "fiat_currency"], {
  unique: true,
})
@Index("crypto_rate_pkey", ["id"], { unique: true })
@Entity("crypto_rate", { schema: "public" })
export class CryptoRate {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  fiat_currency: string;

  @Column("text")
  crypto_currency: string;

  @Column("numeric")
  rate: string;

  @Column("timestamp without time zone", {
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date | null;

  @Column("timestamp without time zone", {
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  updated_at: Date | null;

  @Column("uuid")
  chain_id: string;

  @ManyToOne(() => Chain, (chain) => chain.crypto_rates, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "chain_id", referencedColumnName: "id" }])
  chain: Chain;
}
