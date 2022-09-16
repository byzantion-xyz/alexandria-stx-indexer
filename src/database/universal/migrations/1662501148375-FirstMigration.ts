import { MigrationInterface, QueryRunner } from "typeorm";

export class FirstMigration1662501148375 implements MigrationInterface {
  name = "FirstMigration1662501148375";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "collection_attribute" ("id" uuid NOT NULL, "value" text NOT NULL, "rarity" double precision NOT NULL, "collection_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "trait_type" text NOT NULL, CONSTRAINT "PK_b043906144192897fe3e8bcf114" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "collection_attribute_pkey" ON "collection_attribute" ("id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "collection_attribute_collection_id_trait_type_value_key" ON "collection_attribute" ("collection_id", "trait_type", "value") `
    );
    await queryRunner.query(
      `CREATE TABLE "bid_attribute" ("bid_id" uuid NOT NULL, "collection_attribute_id" uuid NOT NULL, CONSTRAINT "PK_18bd9003dbcefe598aaf8172c35" PRIMARY KEY ("bid_id", "collection_attribute_id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "bid_attribute_pkey" ON "bid_attribute" ("bid_id", "collection_attribute_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "chain" ("id" uuid NOT NULL, "name" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "format_digits" integer NOT NULL, "coin" text, "symbol" text NOT NULL, CONSTRAINT "PK_8e273aafae283b886672c952ecd" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "chain_symbol_key" ON "chain" ("symbol") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "chain_pkey" ON "chain" ("id") `);
    await queryRunner.query(
      `CREATE TABLE "nft_meta_attribute" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trait_type" text NOT NULL, "value" text NOT NULL, "rarity" double precision NOT NULL DEFAULT '0', "score" double precision NOT NULL DEFAULT '0', "meta_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PK_3a0261cd67e7c38b151dff87cf3" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "nft_meta_attribute_trait_type_value_idx" ON "nft_meta_attribute" ("trait_type", "value") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "nft_meta_attribute_meta_id_trait_type_value_key" ON "nft_meta_attribute" ("meta_id", "trait_type", "value") `
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "nft_meta_attribute_pkey" ON "nft_meta_attribute" ("id") `);
    await queryRunner.query(
      `CREATE TABLE "commission" ("id" uuid NOT NULL, "commission_key" text NOT NULL, "custodial" boolean NOT NULL, "commission" real NOT NULL DEFAULT '0', "royalty" real NOT NULL DEFAULT '0', "amount" integer, "smart_contract_id" uuid NOT NULL, "market_name" character varying(64) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "REL_bbc8a8cc88fe7fe6c7f19a581c" UNIQUE ("smart_contract_id"), CONSTRAINT "PK_d108d70411783e2a3a84e386601" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "commission_pkey" ON "commission" ("id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "commission_commission_key_key" ON "commission" ("commission_key") `);
    await queryRunner.query(
      `CREATE TABLE "nft_state_list" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "listed" boolean NOT NULL DEFAULT 'false', "list_price" numeric(40,0), "list_seller" text, "list_block_height" bigint, "list_block_datetime" TIMESTAMP, "list_tx_index" bigint, "list_sub_block_seq" bigint, "function_args" jsonb, "list_contract_id" uuid, "commission_id" uuid, "nft_state_id" uuid, CONSTRAINT "PK_e77d6089792f9ca38031d7b86d3" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "nft_state_list_nft_state_id_list_contract_id_key" ON "nft_state_list" ("nft_state_id", "list_contract_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "nft_state" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "burned" boolean NOT NULL DEFAULT 'false', "minted" boolean NOT NULL DEFAULT 'false', "mint_tx" text, "staked" boolean NOT NULL DEFAULT 'false', "staked_owner" text, "staked_block_height" bigint, "staked_tx_index" bigint, "meta_id" uuid NOT NULL, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "staked_contract_id" uuid, CONSTRAINT "REL_cc9e5c91791f0c3c7e00813f5e" UNIQUE ("meta_id"), CONSTRAINT "PK_ee9754dea689230059113fa63b2" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "nft_state_meta_id_key" ON "nft_state" ("meta_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "nft_state_pkey" ON "nft_state" ("id") `);
    await queryRunner.query(
      `CREATE TABLE "nft_meta" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "uuid" text NOT NULL, "name" text NOT NULL, "image" text NOT NULL, "token_id" text NOT NULL, "rarity" double precision, "ranking" integer NOT NULL, "asset_name" text, "grouping" text, "collection_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "chain_locked" boolean NOT NULL DEFAULT 'false', "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "json_meta" jsonb, "chain_id" uuid NOT NULL, "smart_contract_id" uuid NOT NULL, CONSTRAINT "PK_e299ded43ce51cec11969da8a8e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "nft_meta_pkey" ON "nft_meta" ("id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "nft_meta_collection_id_token_id_key" ON "nft_meta" ("collection_id", "token_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "bid_state_nft_meta" ("bid_id" uuid NOT NULL, "meta_id" uuid NOT NULL, CONSTRAINT "PK_1cf1cfc421b27f3e8446f6e35c9" PRIMARY KEY ("bid_id", "meta_id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "bid_state_nft_meta_pkey" ON "bid_state_nft_meta" ("bid_id", "meta_id") `
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bid_state_status_enum" AS ENUM('active', 'pending', 'cancelled', 'matched')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bid_state_bid_type_enum" AS ENUM('collection', 'attribute', 'solo')`
    );
    await queryRunner.query(
      `CREATE TABLE "bid_state" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nonce" integer NOT NULL, "bid_contract_nonce" text NOT NULL, "bid_buyer" text NOT NULL, "bid_seller" text, "status" "public"."bid_state_status_enum" NOT NULL DEFAULT 'active', "pending_txs" text array, "pending_tx" text NOT NULL, "tx_id" text NOT NULL, "tx_index" bigint NOT NULL, "block_height" bigint NOT NULL, "match_tx_id" text NOT NULL, "cancel_tx_id" text NOT NULL, "bid_type" "public"."bid_state_bid_type_enum" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "bid_price" numeric(40,0), "smart_contract_id" uuid NOT NULL, "collection_id" uuid, CONSTRAINT "PK_f3aea4eeef46336a1f38fe17079" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "bid_state_pkey" ON "bid_state" ("id") `);
    await queryRunner.query(
      `CREATE TABLE "smart_contract_function" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "function_name" text NOT NULL, "args" jsonb NOT NULL, "data" jsonb, "smart_contract_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PK_5ba018ab26c80fbc0be12d3cf62" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "smart_contract_function_pkey" ON "smart_contract_function" ("id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "smart_contract_function_function_name_smart_contract_id_key" ON "smart_contract_function" ("function_name", "smart_contract_id") `
    );
    await queryRunner.query(
      `CREATE TYPE "public"."smart_contract_type_enum" AS ENUM('non_fungible_tokens', 'token_series', 'marketplace', 'staking', 'utility', 'fungible_tokens', 'bridge')`
    );
    await queryRunner.query(
      `CREATE TABLE "smart_contract" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contract_key" text NOT NULL, "contract_key_wrapper" text, "name" text, "scanned_transactions" integer NOT NULL DEFAULT '0', "type" "public"."smart_contract_type_enum" array NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "asset_name" text, "frozen" boolean NOT NULL DEFAULT 'false', "json_meta" jsonb, "spec" text, "base_marketplace_uri" text, "collection_uri" text, "token_uri" text, "chain_id" uuid NOT NULL, "default_commission_id" uuid, "custodial_smart_contract_id" uuid, CONSTRAINT "REL_b3d3b650b96811f09af0989589" UNIQUE ("default_commission_id"), CONSTRAINT "REL_cbb28491b126f13aff665c56de" UNIQUE ("custodial_smart_contract_id"), CONSTRAINT "PK_27627aca2eebd2eb72f26f6399a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "smart_contract_pkey" ON "smart_contract" ("id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "smart_contract_contract_key_key" ON "smart_contract" ("contract_key") `
    );
    await queryRunner.query(
      `CREATE TYPE "public"."action_action_enum" AS ENUM('list', 'unlist', 'buy', 'accept-collection-bid', 'accept-attribute-bid', 'accept-bid', 'asking-price', 'attribute-bid', 'bid', 'cancel-attribute-bid', 'cancel-collection-bid', 'collection-bid', 'mint', 'multi-attribute-bid', 'multi-collection-bid', 'relist', 'stake', 'transfer', 'unlist-bid', 'unlist-collection-bid', 'unstake', 'solo-bid')`
    );
    await queryRunner.query(
      `CREATE TABLE "action" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" "public"."action_action_enum" NOT NULL, "bid_attribute" jsonb, "list_price" numeric(40,0), "seller" text, "buyer" text, "bid_price" numeric(40,0), "block_height" bigint NOT NULL, "tx_index" bigint, "block_time" TIMESTAMP NOT NULL, "tx_id" text NOT NULL, "segment" boolean NOT NULL DEFAULT false, "market_name" text, "nonce" bigint, "units" integer, "collection_id" uuid NOT NULL, "marketplace_smart_contract_id" uuid NOT NULL, "nft_meta_id" uuid NOT NULL, "smart_contract_id" uuid NOT NULL, "commission_id" uuid, CONSTRAINT "PK_2d9db9cf5edfbbae74eb56e3a39" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "action_pkey" ON "action" ("id") `);
    await queryRunner.query(
      `CREATE TABLE "collection" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "collection_size" numeric(14), "description" text, "external_url" text, "volume" numeric(14) NOT NULL DEFAULT '0', "floor" integer NOT NULL DEFAULT '0', "cover_image" text, "trending" boolean NOT NULL DEFAULT 'false', "title" text, "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "slug" text, "collection_scrape_id" uuid, "smart_contract_id" uuid NOT NULL, CONSTRAINT "PK_ad3f485bbc99d875491f44d7c85" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "collection_slug_key" ON "collection" ("slug") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "collection_pkey" ON "collection" ("id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "collection_collection_scrape_id_key" ON "collection" ("collection_scrape_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "collection_creator" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "wallet_id" text NOT NULL, "name" text, "bio" text, "twitter" text, "discord" text, "website" text, "collection_id" uuid NOT NULL, CONSTRAINT "REL_6dbdf40fb884a789e3cd1d41a5" UNIQUE ("collection_id"), CONSTRAINT "PK_6753650e35d87d7c96af6f68606" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "collection_creator_pkey" ON "collection_creator" ("id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "collection_creator_collection_id_key" ON "collection_creator" ("collection_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "collection_attribute" ADD CONSTRAINT "FK_c51a68ee50c7d5c98bd8aa11b66" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "bid_attribute" ADD CONSTRAINT "FK_34cb66a61ea16d7b466a2fa1b87" FOREIGN KEY ("bid_id") REFERENCES "bid_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "bid_attribute" ADD CONSTRAINT "FK_d7765039343327c3610a99a482f" FOREIGN KEY ("collection_attribute_id") REFERENCES "collection_attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_meta_attribute" ADD CONSTRAINT "FK_a8979ab94e9159735d0c2e1f9a6" FOREIGN KEY ("meta_id") REFERENCES "nft_meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "commission" ADD CONSTRAINT "FK_bbc8a8cc88fe7fe6c7f19a581c6" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_state_list" ADD CONSTRAINT "FK_93c7655c8bcf484a30b70116aab" FOREIGN KEY ("list_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_state_list" ADD CONSTRAINT "FK_2384df710e06e22d43ce38838a4" FOREIGN KEY ("commission_id") REFERENCES "commission"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_state_list" ADD CONSTRAINT "FK_a5e3b56221d5b7c6f38b753714f" FOREIGN KEY ("nft_state_id") REFERENCES "nft_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_state" ADD CONSTRAINT "FK_54882955e64586d92f247515207" FOREIGN KEY ("staked_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_state" ADD CONSTRAINT "FK_cc9e5c91791f0c3c7e00813f5e5" FOREIGN KEY ("meta_id") REFERENCES "nft_meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_meta" ADD CONSTRAINT "FK_312899497138fabecd8dae7ce30" FOREIGN KEY ("chain_id") REFERENCES "chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_meta" ADD CONSTRAINT "FK_f1d0f2d9765255ce6ff3a847beb" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "nft_meta" ADD CONSTRAINT "FK_681f7cd137ff4501cadd4202748" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "bid_state_nft_meta" ADD CONSTRAINT "FK_14b4044c9e479675f51475960d0" FOREIGN KEY ("bid_id") REFERENCES "bid_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "bid_state_nft_meta" ADD CONSTRAINT "FK_f470616db382e6d6b462ff5c4c6" FOREIGN KEY ("meta_id") REFERENCES "nft_meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "bid_state" ADD CONSTRAINT "FK_7b27ea34a8cd6e9ae2e724d18f5" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "bid_state" ADD CONSTRAINT "FK_26f51f004adcefcc9016cec3ac7" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "smart_contract_function" ADD CONSTRAINT "FK_ad7cc77b08874ab92ab53d6e18b" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "smart_contract" ADD CONSTRAINT "FK_3c983c6df100abf08b6891ac5b2" FOREIGN KEY ("chain_id") REFERENCES "chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "smart_contract" ADD CONSTRAINT "FK_b3d3b650b96811f09af0989589a" FOREIGN KEY ("default_commission_id") REFERENCES "commission"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "smart_contract" ADD CONSTRAINT "FK_cbb28491b126f13aff665c56de9" FOREIGN KEY ("custodial_smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD CONSTRAINT "FK_98dfc026027f498b547a2baeed4" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD CONSTRAINT "FK_49c24dc50bbc0199dfea3eba195" FOREIGN KEY ("marketplace_smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD CONSTRAINT "FK_5538124ca8f1a96e8ce74bb2a8f" FOREIGN KEY ("nft_meta_id") REFERENCES "nft_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD CONSTRAINT "FK_d48a59f2ab49e48323d76696d55" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD CONSTRAINT "FK_52b814416d3f9e6e4c3314ce70a" FOREIGN KEY ("commission_id") REFERENCES "commission"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "collection" ADD CONSTRAINT "FK_064bf5aae03f9a657afb85e2b34" FOREIGN KEY ("smart_contract_id") REFERENCES "smart_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "collection_creator" ADD CONSTRAINT "FK_6dbdf40fb884a789e3cd1d41a5b" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "collection_creator" DROP CONSTRAINT "FK_6dbdf40fb884a789e3cd1d41a5b"`);
    await queryRunner.query(`ALTER TABLE "collection" DROP CONSTRAINT "FK_064bf5aae03f9a657afb85e2b34"`);
    await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "FK_52b814416d3f9e6e4c3314ce70a"`);
    await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "FK_d48a59f2ab49e48323d76696d55"`);
    await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "FK_5538124ca8f1a96e8ce74bb2a8f"`);
    await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "FK_49c24dc50bbc0199dfea3eba195"`);
    await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "FK_98dfc026027f498b547a2baeed4"`);
    await queryRunner.query(`ALTER TABLE "smart_contract" DROP CONSTRAINT "FK_cbb28491b126f13aff665c56de9"`);
    await queryRunner.query(`ALTER TABLE "smart_contract" DROP CONSTRAINT "FK_b3d3b650b96811f09af0989589a"`);
    await queryRunner.query(`ALTER TABLE "smart_contract" DROP CONSTRAINT "FK_3c983c6df100abf08b6891ac5b2"`);
    await queryRunner.query(`ALTER TABLE "smart_contract_function" DROP CONSTRAINT "FK_ad7cc77b08874ab92ab53d6e18b"`);
    await queryRunner.query(`ALTER TABLE "bid_state" DROP CONSTRAINT "FK_26f51f004adcefcc9016cec3ac7"`);
    await queryRunner.query(`ALTER TABLE "bid_state" DROP CONSTRAINT "FK_7b27ea34a8cd6e9ae2e724d18f5"`);
    await queryRunner.query(`ALTER TABLE "bid_state_nft_meta" DROP CONSTRAINT "FK_f470616db382e6d6b462ff5c4c6"`);
    await queryRunner.query(`ALTER TABLE "bid_state_nft_meta" DROP CONSTRAINT "FK_14b4044c9e479675f51475960d0"`);
    await queryRunner.query(`ALTER TABLE "nft_meta" DROP CONSTRAINT "FK_681f7cd137ff4501cadd4202748"`);
    await queryRunner.query(`ALTER TABLE "nft_meta" DROP CONSTRAINT "FK_f1d0f2d9765255ce6ff3a847beb"`);
    await queryRunner.query(`ALTER TABLE "nft_meta" DROP CONSTRAINT "FK_312899497138fabecd8dae7ce30"`);
    await queryRunner.query(`ALTER TABLE "nft_state" DROP CONSTRAINT "FK_cc9e5c91791f0c3c7e00813f5e5"`);
    await queryRunner.query(`ALTER TABLE "nft_state" DROP CONSTRAINT "FK_54882955e64586d92f247515207"`);
    await queryRunner.query(`ALTER TABLE "nft_state_list" DROP CONSTRAINT "FK_a5e3b56221d5b7c6f38b753714f"`);
    await queryRunner.query(`ALTER TABLE "nft_state_list" DROP CONSTRAINT "FK_2384df710e06e22d43ce38838a4"`);
    await queryRunner.query(`ALTER TABLE "nft_state_list" DROP CONSTRAINT "FK_93c7655c8bcf484a30b70116aab"`);
    await queryRunner.query(`ALTER TABLE "commission" DROP CONSTRAINT "FK_bbc8a8cc88fe7fe6c7f19a581c6"`);
    await queryRunner.query(`ALTER TABLE "nft_meta_attribute" DROP CONSTRAINT "FK_a8979ab94e9159735d0c2e1f9a6"`);
    await queryRunner.query(`ALTER TABLE "bid_attribute" DROP CONSTRAINT "FK_d7765039343327c3610a99a482f"`);
    await queryRunner.query(`ALTER TABLE "bid_attribute" DROP CONSTRAINT "FK_34cb66a61ea16d7b466a2fa1b87"`);
    await queryRunner.query(`ALTER TABLE "collection_attribute" DROP CONSTRAINT "FK_c51a68ee50c7d5c98bd8aa11b66"`);
    await queryRunner.query(`DROP INDEX "public"."collection_creator_collection_id_key"`);
    await queryRunner.query(`DROP INDEX "public"."collection_creator_pkey"`);
    await queryRunner.query(`DROP TABLE "collection_creator"`);
    await queryRunner.query(`DROP INDEX "public"."collection_collection_scrape_id_key"`);
    await queryRunner.query(`DROP INDEX "public"."collection_pkey"`);
    await queryRunner.query(`DROP INDEX "public"."collection_slug_key"`);
    await queryRunner.query(`DROP TABLE "collection"`);
    await queryRunner.query(`DROP INDEX "public"."action_pkey"`);
    await queryRunner.query(`DROP TABLE "action"`);
    await queryRunner.query(`DROP TYPE "public"."action_action_enum"`);
    await queryRunner.query(`DROP INDEX "public"."smart_contract_contract_key_key"`);
    await queryRunner.query(`DROP INDEX "public"."smart_contract_pkey"`);
    await queryRunner.query(`DROP TABLE "smart_contract"`);
    await queryRunner.query(`DROP TYPE "public"."smart_contract_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."smart_contract_function_function_name_smart_contract_id_key"`);
    await queryRunner.query(`DROP INDEX "public"."smart_contract_function_pkey"`);
    await queryRunner.query(`DROP TABLE "smart_contract_function"`);
    await queryRunner.query(`DROP INDEX "public"."bid_state_pkey"`);
    await queryRunner.query(`DROP TABLE "bid_state"`);
    await queryRunner.query(`DROP TYPE "public"."bid_state_bid_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bid_state_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."bid_state_nft_meta_pkey"`);
    await queryRunner.query(`DROP TABLE "bid_state_nft_meta"`);
    await queryRunner.query(`DROP INDEX "public"."nft_meta_collection_id_token_id_key"`);
    await queryRunner.query(`DROP INDEX "public"."nft_meta_pkey"`);
    await queryRunner.query(`DROP TABLE "nft_meta"`);
    await queryRunner.query(`DROP INDEX "public"."nft_state_pkey"`);
    await queryRunner.query(`DROP INDEX "public"."nft_state_meta_id_key"`);
    await queryRunner.query(`DROP TABLE "nft_state"`);
    await queryRunner.query(`DROP INDEX "public"."nft_state_list_nft_state_id_list_contract_id_key"`);
    await queryRunner.query(`DROP TABLE "nft_state_list"`);
    await queryRunner.query(`DROP INDEX "public"."commission_commission_key_key"`);
    await queryRunner.query(`DROP INDEX "public"."commission_pkey"`);
    await queryRunner.query(`DROP TABLE "commission"`);
    await queryRunner.query(`DROP INDEX "public"."nft_meta_attribute_pkey"`);
    await queryRunner.query(`DROP INDEX "public"."nft_meta_attribute_meta_id_trait_type_value_key"`);
    await queryRunner.query(`DROP INDEX "public"."nft_meta_attribute_trait_type_value_idx"`);
    await queryRunner.query(`DROP TABLE "nft_meta_attribute"`);
    await queryRunner.query(`DROP INDEX "public"."chain_pkey"`);
    await queryRunner.query(`DROP INDEX "public"."chain_symbol_key"`);
    await queryRunner.query(`DROP TABLE "chain"`);
    await queryRunner.query(`DROP INDEX "public"."bid_attribute_pkey"`);
    await queryRunner.query(`DROP TABLE "bid_attribute"`);
    await queryRunner.query(`DROP INDEX "public"."collection_attribute_collection_id_trait_type_value_key"`);
    await queryRunner.query(`DROP INDEX "public"."collection_attribute_pkey"`);
    await queryRunner.query(`DROP TABLE "collection_attribute"`);
  }
}
