alter table "public".nft_state add column commission_id uuid null;
ALTER TABLE "public".nft_state
    ADD CONSTRAINT nft_state_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES commission (id) ON DELETE SET NULL ON UPDATE CASCADE;

