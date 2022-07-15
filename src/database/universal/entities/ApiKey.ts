import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("chain", { schema: "public" })
export class ApiKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: false })
  client_name: string;

  @Column({ nullable: false, unique: true, width: 7 })
  prefix: string;

  @Column({ nullable: false, width: 32 })
  keyhash: string;
}
