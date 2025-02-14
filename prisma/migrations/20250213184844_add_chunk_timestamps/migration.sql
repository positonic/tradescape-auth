/*
  Warnings:

  - You are about to drop the column `chunk_end` on the `VideoChunk` table. All the data in the column will be lost.
  - You are about to drop the column `chunk_start` on the `VideoChunk` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "VideoChunk" DROP COLUMN "chunk_end",
DROP COLUMN "chunk_start",
ADD COLUMN     "chunk_end_time" DOUBLE PRECISION,
ADD COLUMN     "chunk_start_time" DOUBLE PRECISION;
