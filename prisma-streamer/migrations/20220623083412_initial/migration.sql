/*
  Warnings:

  - You are about to drop the column `receiver_id` on the `transaction` table. All the data in the column will be lost.
  - You are about to drop the column `success_receipt_id` on the `transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transaction" DROP COLUMN "receiver_id",
DROP COLUMN "success_receipt_id";

/* Add JSONB generated columns */
ALTER TABLE public."transaction" ADD success_receipt_id text NULL GENERATED ALWAYS AS ((((outcome -> 'execution_outcome'::text) -> 'outcome'::text) -> 'status'::text) ->> 'SuccessReceiptId'::text) STORED;
ALTER TABLE public."transaction" ADD receiver_id text NULL GENERATED ALWAYS AS (transaction ->> 'receiver_id'::text) STORED;

/* Create indexes for jsonb generated colums */
CREATE INDEX transaction_receiver_id_idx ON public.transaction USING btree (receiver_id);
CREATE INDEX transaction_success_receipt_id_idx ON public.transaction USING btree (success_receipt_id);
