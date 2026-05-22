-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_setupId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_pairId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_pairId_fkey";

-- DropForeignKey
ALTER TABLE "Setup" DROP CONSTRAINT "Setup_coinId_fkey";

-- DropForeignKey
ALTER TABLE "Setup" DROP CONSTRAINT "Setup_transcriptionSessionId_fkey";

-- DropForeignKey
ALTER TABLE "TranscriptionSession" DROP CONSTRAINT "TranscriptionSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserTrade" DROP CONSTRAINT "UserTrade_pairId_fkey";

-- AlterTable
ALTER TABLE "Setup" ADD COLUMN     "sourceId" INTEGER;

-- CreateTable
CREATE TABLE "Source" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Source_userId_idx" ON "Source"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_userId_name_key" ON "Source"("userId", "name");

-- CreateIndex
CREATE INDEX "Setup_sourceId_idx" ON "Setup"("sourceId");

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_transcriptionSessionId_fkey" FOREIGN KEY ("transcriptionSessionId") REFERENCES "TranscriptionSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptionSession" ADD CONSTRAINT "TranscriptionSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrade" ADD CONSTRAINT "UserTrade_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
