import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { SmartContract } from "./SmartContract";

@Index("commission_commission_key_key", ["commissionKey"], { unique: true })
@Index("commission_pkey", ["id"], { unique: true })
@Index("commission_smart_contract_id_key", ["smart_contract_id"], {
  unique: true,
})
@Entity("commission", { schema: "public" })
export class Commission {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  commissionKey: string;

  @Column("boolean")
  custodial: boolean;

  @Column("integer", { nullable: true })
  amount: number | null;

  @Column("uuid")
  smart_contract_id: string;

  @Column("timestamp without time zone", {
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @OneToOne(() => SmartContract, (smartContract) => smartContract.commission, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smart_contract: SmartContract;
}
