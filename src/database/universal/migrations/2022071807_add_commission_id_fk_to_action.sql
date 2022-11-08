alter table "public".action add column commission_id uuid null;
ALTER TABLE "public".action
    ADD CONSTRAINT action_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES commission (id) ON DELETE SET NULL ON UPDATE CASCADE;