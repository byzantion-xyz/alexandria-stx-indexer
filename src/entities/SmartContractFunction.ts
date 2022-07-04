import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { SmartContract } from "./SmartContract";

@Index(
  "smart_contract_function_function_name_smart_contract_id_key",
  ["functionName", "smartContractId"],
  { unique: true }
)
@Index("smart_contract_function_pkey", ["id"], { unique: true })
@Entity("smart_contract_function", { schema: "public" })
export class SmartContractFunction {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "name" })
  name: string;

  @Column("text", { name: "function_name" })
  functionName: string;

  @Column("jsonb", { name: "args" })
  args: object;

  @Column("uuid", { name: "smart_contract_id" })
  smartContractId: string;

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(
    () => SmartContract,
    (smartContract) => smartContract.smartContractFunctions,
    { onDelete: "RESTRICT", onUpdate: "CASCADE" }
  )
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smartContract: SmartContract;
}
