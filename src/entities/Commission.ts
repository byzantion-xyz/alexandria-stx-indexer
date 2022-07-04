import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { SmartContract } from "./SmartContract";

@Index("commission_commission_key_key", ["commissionKey"], { unique: true })
@Index("commission_pkey", ["id"], { unique: true })
@Index("commission_smart_contract_id_key", ["smartContractId"], {
  unique: true,
})
@Entity("commission", { schema: "public" })
export class Commission {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "commission_key" })
  commissionKey: string;

  @Column("boolean", { name: "custodial" })
  custodial: boolean;

  @Column("integer", { name: "amount", nullable: true })
  amount: number | null;

  @Column("uuid", { name: "smart_contract_id" })
  smartContractId: string;

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @OneToOne(() => SmartContract, (smartContract) => smartContract.commission, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smartContract: SmartContract;
}
