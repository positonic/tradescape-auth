/*
  Warnings:

  - You are about to drop the column `chunkEmbedding` on the `VideoChunk` table. All the data in the column will be lost.
  - Added the required column `chunk_embedding` to the `VideoChunk` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "VideoChunk_chunkEmbedding_idx";

-- AlterTable
ALTER TABLE "VideoChunk" DROP COLUMN "chunkEmbedding",
ADD COLUMN     "chunk_embedding" vector(1536) NOT NULL,
ADD COLUMN     "chunk_end" INTEGER,
ADD COLUMN     "chunk_start" INTEGER;

-- CreateIndex
CREATE INDEX "VideoChunk_chunk_embedding_idx" ON "VideoChunk"("chunk_embedding");
