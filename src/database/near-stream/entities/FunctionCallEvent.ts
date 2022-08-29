import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('function_call_event', { schema: 'public' })
export class FunctionCallEvent {
  @PrimaryColumn()
  originating_receipt_id: string;

  @Column()
  signer_id: string;

  @Column()
  receiver_id: string;

  @Column()
  method: string;

  @Column()
  args: string;

  @Column()
  readonly executed_block_hash!: string;

  @Column()
  readonly executed_block_height!: number;

  @Column()
  readonly executed_block_timestamp!: number;

  @Column({ default: false })
  processed: boolean;

  @Column({ default: false })
  missing: boolean;
}
