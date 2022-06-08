/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `collection` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "collection_slug_key" ON "collection"("slug");
