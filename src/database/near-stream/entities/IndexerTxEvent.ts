import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('indexer_tx_event_23092022', { schema: 'public' })
export class IndexerTxEvent {

    @PrimaryColumn()
    hash: string;

    @Column('bigint')
    nonce: bigint;

    @Column()
    signer_id: string;

    @Column()
    receiver_id: string;

    @Column('jsonb')
    receipts: JSON[];

    @Column()
    contains_event: boolean;

    @Column()
    readonly block_hash!: string;

    @Column('bigint')
    readonly block_height!: bigint;

    @Column('bigint')
    readonly block_timestamp!: bigint;
}
