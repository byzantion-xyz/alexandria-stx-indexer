import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('indexer_tx_event', { schema: 'public' })
export class IndexerTxEvent {

    @PrimaryColumn()
    hash: string;

    @Column()
    nonce: bigint;

    @Column()
    signer_id: string;

    @Column()
    receiver_id: string;

    @Column()
    receipts: JSON;

    @Column()
    contains_event: boolean;

    @Column()
    readonly block_hash!: string;

    @Column()
    readonly block_height!: number;

    @Column()
    readonly block_timestamp!: number;

    @Column()
    processed: boolean;

    @Column()
    missing: boolean;
}
