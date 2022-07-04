import { Column, Entity, Index } from "typeorm";

@Index("_prisma_migrations_pkey", ["id"], { unique: true })
@Entity("_prisma_migrations", { schema: "public" })
export class PrismaMigrations {
  @Column("character varying", { primary: true, name: "id", length: 36 })
  id: string;

  @Column("character varying", { name: "checksum", length: 64 })
  checksum: string;

  @Column("timestamp with time zone", { name: "finished_at", nullable: true })
  finishedAt: Date | null;

  @Column("character varying", { name: "migration_name", length: 255 })
  migrationName: string;

  @Column("text", { name: "logs", nullable: true })
  logs: string | null;

  @Column("timestamp with time zone", {
    name: "rolled_back_at",
    nullable: true,
  })
  rolledBackAt: Date | null;

  @Column("timestamp with time zone", {
    name: "started_at",
    default: () => "now()",
  })
  startedAt: Date;

  @Column("integer", { name: "applied_steps_count", default: () => "0" })
  appliedStepsCount: number;
}
