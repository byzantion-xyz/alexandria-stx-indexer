import { Column, Entity, PrimaryColumn } from 'typeorm';


@Entity('transaction', { schema: 'public' })
export class Transaction {
  @PrimaryColumn()
  hash: string;

  @Column('jsonb')
  outcome: JSON;

  @Column('jsonb')
  transaction: JSON;

  @Column({ default: false })
  processed: boolean;

  @Column({ default: false })
  missing: boolean;

  @Column()
  readonly block_height!: number;

  @Column()
  readonly block_timestamp!: number;

  @Column()
  readonly block_hash!: string;

  @Column()
  readonly success_receipt_id!: string;

  @Column()
  readonly receiver_id!: string;
}
