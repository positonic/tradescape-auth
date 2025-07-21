-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE', 'CANDLE');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('ABOVE', 'BELOW');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'TRIGGERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" TEXT NOT NULL DEFAULT 'Quick',
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT,
    "videoUrl" TEXT NOT NULL,
    "transcription" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "isSearchable" BOOLEAN DEFAULT false,
    "description" TEXT,
    "summary" TEXT,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVideo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoChunk" (
    "id" SERIAL NOT NULL,
    "video_id" TEXT,
    "chunk_text" TEXT NOT NULL,
    "chunk_start" INTEGER,
    "chunk_end" INTEGER,
    "chunk_start_time" DOUBLE PRECISION,
    "chunk_end_time" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setup" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "entryPrice" DECIMAL(65,30),
    "takeProfitPrice" DECIMAL(65,30),
    "stopPrice" DECIMAL(65,30),
    "timeframe" TEXT,
    "confidence" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "videoId" TEXT,
    "pairId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "coinId" INTEGER,
    "privacy" TEXT NOT NULL DEFAULT 'private',
    "userId" TEXT NOT NULL,
    "transcriptionSessionId" TEXT,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "imageUrl" TEXT,
    "coinId" TEXT,

    CONSTRAINT "Coin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pair" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseCoinId" INTEGER NOT NULL DEFAULT 1,
    "quoteCoinId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Pair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPair" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "pairId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "lastTradesSyncTime" TIMESTAMP(3),

    CONSTRAINT "UserPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exchange" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeUser" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "lastTradesSyncTime" TIMESTAMP(3),

    CONSTRAINT "ExchangeUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptionSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "transcription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "setupId" TEXT,
    "title" TEXT,
    "description" TEXT,

    CONSTRAINT "TranscriptionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "transcriptionSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "threshold" DECIMAL(65,30) NOT NULL,
    "direction" "Direction" NOT NULL,
    "interval" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pairId" INTEGER NOT NULL,
    "setupId" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrade" (
    "id" SERIAL NOT NULL,
    "ordertxid" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "time" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "ordertype" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "cost" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "vol" DOUBLE PRECISION NOT NULL,
    "margin" TEXT NOT NULL,
    "leverage" TEXT NOT NULL,
    "misc" TEXT NOT NULL,
    "closedPnL" DECIMAL(65,30),
    "tradeId" TEXT NOT NULL,
    "transactionId" TEXT,
    "direction" TEXT,
    "exchange" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" INTEGER,
    "pairId" INTEGER,

    CONSTRAINT "UserTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "ordertxid" TEXT NOT NULL,
    "time" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT,
    "pair" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "totalCost" DECIMAL(65,30) NOT NULL,
    "fee" DECIMAL(65,30) NOT NULL,
    "highestPrice" DECIMAL(65,30) NOT NULL,
    "lowestPrice" DECIMAL(65,30) NOT NULL,
    "averagePrice" DECIMAL(65,30) NOT NULL,
    "exchange" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "closedPnL" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positionId" INTEGER,
    "pairId" INTEGER,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,
    "positionType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "pairId" INTEGER,
    "averageEntryPrice" DECIMAL(65,30) NOT NULL,
    "averageExitPrice" DECIMAL(65,30) NOT NULL,
    "totalCostBuy" DECIMAL(65,30) NOT NULL,
    "totalCostSell" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "profitLoss" DECIMAL(65,30) NOT NULL,
    "duration" TEXT NOT NULL,
    "time" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalUsdValue" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");

-- CreateIndex
CREATE INDEX "Action_createdById_idx" ON "Action"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Video_slug_key" ON "Video"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Video_videoUrl_key" ON "Video"("videoUrl");

-- CreateIndex
CREATE UNIQUE INDEX "UserVideo_userId_videoId_key" ON "UserVideo"("userId", "videoId");

-- CreateIndex
CREATE INDEX "UserVideo_userId_idx" ON "UserVideo"("userId");

-- CreateIndex
CREATE INDEX "UserVideo_videoId_idx" ON "UserVideo"("videoId");

-- CreateIndex
CREATE INDEX "Setup_userId_idx" ON "Setup"("userId");

-- CreateIndex
CREATE INDEX "Setup_videoId_idx" ON "Setup"("videoId");

-- CreateIndex
CREATE INDEX "Setup_pairId_idx" ON "Setup"("pairId");

-- CreateIndex
CREATE INDEX "Setup_coinId_idx" ON "Setup"("coinId");

-- CreateIndex
CREATE INDEX "Setup_transcriptionSessionId_idx" ON "Setup"("transcriptionSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Coin_coinId_key" ON "Coin"("coinId");

-- CreateIndex
CREATE UNIQUE INDEX "Pair_symbol_key" ON "Pair"("symbol");

-- CreateIndex
CREATE INDEX "Pair_baseCoinId_idx" ON "Pair"("baseCoinId");

-- CreateIndex
CREATE INDEX "Pair_quoteCoinId_idx" ON "Pair"("quoteCoinId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPair_userId_pairId_exchangeId_key" ON "UserPair"("userId", "pairId", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_name_key" ON "Exchange"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptionSession_sessionId_key" ON "TranscriptionSession"("sessionId");

-- CreateIndex
CREATE INDEX "TranscriptionSession_sessionId_idx" ON "TranscriptionSession"("sessionId");

-- CreateIndex
CREATE INDEX "TranscriptionSession_userId_idx" ON "TranscriptionSession"("userId");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_pairId_idx" ON "Alert"("pairId");

-- CreateIndex
CREATE INDEX "Alert_setupId_idx" ON "Alert"("setupId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTrade_tradeId_key" ON "UserTrade"("tradeId");

-- CreateIndex
CREATE INDEX "UserTrade_pairId_idx" ON "UserTrade"("pairId");

-- CreateIndex
CREATE INDEX "Order_time_idx" ON "Order"("time");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_pair_idx" ON "Order"("pair");

-- CreateIndex
CREATE INDEX "Order_pairId_idx" ON "Order"("pairId");

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "Position"("userId");

-- CreateIndex
CREATE INDEX "Position_pair_idx" ON "Position"("pair");

-- CreateIndex
CREATE INDEX "Position_pairId_idx" ON "Position"("pairId");

-- CreateIndex
CREATE INDEX "Position_time_idx" ON "Position"("time");

-- CreateIndex
CREATE INDEX "Position_status_idx" ON "Position"("status");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_idx" ON "PortfolioSnapshot"("userId");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_exchange_idx" ON "PortfolioSnapshot"("userId", "exchange");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_timestamp_idx" ON "PortfolioSnapshot"("timestamp");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVideo" ADD CONSTRAINT "UserVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVideo" ADD CONSTRAINT "UserVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoChunk" ADD CONSTRAINT "VideoChunk_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "Video"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_transcriptionSessionId_fkey" FOREIGN KEY ("transcriptionSessionId") REFERENCES "TranscriptionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_baseCoinId_fkey" FOREIGN KEY ("baseCoinId") REFERENCES "Coin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_quoteCoinId_fkey" FOREIGN KEY ("quoteCoinId") REFERENCES "Coin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPair" ADD CONSTRAINT "UserPair_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPair" ADD CONSTRAINT "UserPair_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPair" ADD CONSTRAINT "UserPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeUser" ADD CONSTRAINT "ExchangeUser_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeUser" ADD CONSTRAINT "ExchangeUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptionSession" ADD CONSTRAINT "TranscriptionSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_transcriptionSessionId_fkey" FOREIGN KEY ("transcriptionSessionId") REFERENCES "TranscriptionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrade" ADD CONSTRAINT "UserTrade_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrade" ADD CONSTRAINT "UserTrade_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrade" ADD CONSTRAINT "UserTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;