import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('receipt', { schema: 'public' })
export class Receipt {
  @PrimaryColumn()
  receipt_id: string;

  @Column('jsonb')
  receipt: JSON;

  @Column('jsonb')
  execution_outcome: JSON;
}
