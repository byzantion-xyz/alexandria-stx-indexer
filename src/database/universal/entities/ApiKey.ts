import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("apikey", { schema: "public" })
export class ApiKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: false, width: 1000 })
  client_name: string;

  @Column({ nullable: false, unique: true, width: 7 })
  prefix: string;

  @Column({ nullable: false, width: 60 })
  keyhash: string;
}
