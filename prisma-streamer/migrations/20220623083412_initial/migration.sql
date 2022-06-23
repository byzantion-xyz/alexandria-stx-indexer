/*
  Warnings:

  - You are about to drop the column `receiver_id` on the `transaction` table. All the data in the column will be lost.
  - You are about to drop the column `success_receipt_id` on the `transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transaction" DROP COLUMN "receiver_id",
DROP COLUMN "success_receipt_id";

ALTER TABLE public."transaction" ADD success_receipt_id text NULL GENERATED ALWAYS AS ((((outcome -> 'execution_outcome'::text) -> 'outcome'::text) -> 'status'::text) ->> 'SuccessReceiptId'::text) STORED;
ALTER TABLE public."transaction" ADD receiver_id text NULL GENERATED ALWAYS AS (transaction ->> 'receiver_id'::text) STORED;
