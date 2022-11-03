import { MigrationInterface, QueryRunner } from "typeorm";

export class v002Changes1667407644243 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // collection table
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.collection
            ALTER COLUMN volume SET DEFAULT 0;
        ALTER TABLE public.collection
            ALTER COLUMN floor TYPE numeric(14, 0);
    `);

    // nft_meta
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.nft_meta
            ALTER COLUMN name DROP NOT NULL;
        
        ALTER TABLE IF EXISTS public.nft_meta
            ALTER COLUMN image SET DEFAULT 'https://images.unsplash.com/photo-1628260412297-a3377e45006f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=3774&q=80'::text;
        
        ALTER TABLE IF EXISTS public.nft_meta
            ALTER COLUMN ranking DROP NOT NULL;
        
        ALTER TABLE IF EXISTS public.nft_meta
            ADD COLUMN token_id_numeric numeric(64, 0) GENERATED ALWAYS AS (
        CASE
            WHEN (token_id ~ '^\d+$'::text) THEN (token_id)::numeric
            WHEN (token_id ~ '^\d+:\d+$'::text) THEN (translate(token_id, ':'::text, ''::text))::numeric
            ELSE NULL::numeric
        END) STORED;
    `);

    // bid_state
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.bid_state
            ALTER COLUMN nonce DROP NOT NULL;
        
        ALTER TABLE IF EXISTS public.bid_state
            ALTER COLUMN bid_contract_nonce DROP NOT NULL;

        ALTER TABLE IF EXISTS public.bid_state
            ALTER COLUMN pending_tx DROP NOT NULL;
        
        ALTER TABLE IF EXISTS public.bid_state
            ALTER COLUMN match_tx_id DROP NOT NULL;
        
        ALTER TABLE IF EXISTS public.bid_state
            ALTER COLUMN cancel_tx_id DROP NOT NULL;

        ALTER TABLE IF EXISTS public.bid_state
            ALTER COLUMN bid_price SET NOT NULL;
        
        ALTER TABLE IF EXISTS public.bid_state
            ALTER COLUMN tx_index DROP NOT NULL;
        
        ALTER TABLE IF EXISTS public.bid_state
            ADD COLUMN bid_price_str character varying(50) COLLATE pg_catalog."default" GENERATED ALWAYS AS ((bid_price)::text) STORED;
        
        ALTER TABLE IF EXISTS public.bid_state
            ADD CONSTRAINT bid_contract_nonce_uk UNIQUE (bid_contract_nonce);
    `);

    // nft_state
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.nft_state
            ADD COLUMN owner text COLLATE pg_catalog."default";

        ALTER TABLE IF EXISTS public.nft_state
            ADD COLUMN owner_block_height bigint;

        ALTER TABLE IF EXISTS public.nft_state
            ADD COLUMN owner_tx_id text COLLATE pg_catalog."default";
    `);

    // nft_state_list
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.nft_state_list
            ADD COLUMN list_price_str character varying(50) COLLATE pg_catalog."default" GENERATED ALWAYS AS ((list_price)::text) STORED;

        ALTER TABLE IF EXISTS public.nft_state_list
            ADD COLUMN created_at timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;

        ALTER TABLE IF EXISTS public.nft_state_list
            ADD COLUMN updated_at timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);

    // action table
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.action
            ADD COLUMN created_at timestamp without time zone NOT NULL DEFAULT now();
        
        CREATE UNIQUE INDEX IF NOT EXISTS action_tx_id_tx_index_idx 
            ON public.action USING btree
            (tx_id COLLATE pg_catalog."default" ASC NULLS LAST, tx_index ASC NULLS LAST);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.nft_meta
            DROP COLUMN token_id_numeric;
    `);

    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.bid_state
            DROP COLUMN bid_price_str;

        ALTER TABLE IF EXISTS public.bid_state
            DROP CONSTRAINT bid_contract_nonce_uk;
    `);

    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.nft_state
            DROP COLUMN owner;

        ALTER TABLE IF EXISTS public.nft_state
            DROP COLUMN owner_block_height;

        ALTER TABLE IF EXISTS public.nft_state
            DROP COLUMN owner_tx_id;
    `);

    // nft_state_list
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.nft_state_list
            DROP COLUMN list_price_str;

        ALTER TABLE IF EXISTS public.nft_state_list
            DROP COLUMN created_at;

        ALTER TABLE IF EXISTS public.nft_state_list
            DROP COLUMN updated_at;
    `);

    // action
    await queryRunner.query(`
        ALTER TABLE IF EXISTS public.action
            DROP COLUMN created_at;
    `);
  }
}
