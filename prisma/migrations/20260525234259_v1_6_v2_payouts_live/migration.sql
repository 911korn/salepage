-- CreateEnum
CREATE TYPE "LiveBroadcastStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "affiliateRatePct" SMALLINT;

-- CreateTable
CREATE TABLE "LiveBroadcast" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "rtcProvider" TEXT,
    "rtcChannelId" TEXT,
    "rtcPublishToken" TEXT,
    "rtcSubscribeToken" TEXT,
    "playbackUrl" TEXT,
    "replayUrl" TEXT,
    "status" "LiveBroadcastStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "pinnedProductSlug" TEXT,
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveComment" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "promptpayId" TEXT NOT NULL,
    "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerRef" TEXT,
    "rejectedReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveBroadcast_shopId_status_scheduledAt_idx" ON "LiveBroadcast"("shopId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "LiveBroadcast_status_startedAt_idx" ON "LiveBroadcast"("status", "startedAt");

-- CreateIndex
CREATE INDEX "LiveComment_broadcastId_createdAt_idx" ON "LiveComment"("broadcastId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliatePayout_userId_createdAt_idx" ON "AffiliatePayout"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliatePayout_status_createdAt_idx" ON "AffiliatePayout"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "LiveBroadcast" ADD CONSTRAINT "LiveBroadcast_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveComment" ADD CONSTRAINT "LiveComment_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "LiveBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
