import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { SmartContract } from "./SmartContract";

@Index("smart_contract_function_function_name_smart_contract_id_key", ["function_name", "smart_contract_id"], {
  unique: true,
})
@Index("smart_contract_function_pkey", ["id"], { unique: true })
@Entity("smart_contract_function", { schema: "public" })
export class SmartContractFunction {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  name: string;

  @Column("text")
  function_name: string;

  @Column("jsonb")
  args: object;

  @Column("uuid")
  smart_contract_id: string;

  @Column("timestamp without time zone", {
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @Column("timestamp without time zone")
  updated_at: Date;

  @ManyToOne(() => SmartContract, (smartContract) => smartContract.smart_contract_functions, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "smart_contract_id", referencedColumnName: "id" }])
  smart_contract: SmartContract;
}
