import { Column, Entity, Index } from "typeorm";

@Index("crypto_rates_uk_fiat_crypto", ["cryptoCurrency", "fiatCurrency"], {
  unique: true,
})
@Index("crypto_rate_pkey", ["id"], { unique: true })
@Entity("crypto_rate", { schema: "public" })
export class CryptoRate {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "fiat_currency" })
  fiatCurrency: string;

  @Column("text", { name: "crypto_currency" })
  cryptoCurrency: string;

  @Column("numeric", { name: "rate" })
  rate: string;

  @Column("timestamp without time zone", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date | null;

  @Column("timestamp without time zone", {
    name: "updated_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date | null;
}
