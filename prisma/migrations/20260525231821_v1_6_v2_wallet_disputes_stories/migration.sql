-- CreateEnum
CREATE TYPE "KycDocType" AS ENUM ('NID', 'PASSPORT', 'COMPANY_REG');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShopStoryMediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('NOT_RECEIVED', 'WRONG_ITEM', 'DAMAGED', 'NOT_AS_DESCRIBED', 'PAYMENT_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'AWAITING_SHOP_RESPONSE', 'AWAITING_BUYER_RESPONSE', 'RESOLVED_REFUND', 'RESOLVED_REPLACE', 'RESOLVED_NO_ACTION', 'CLOSED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "referrerCode" TEXT,
ADD COLUMN     "referrerUserId" TEXT;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "kycDocBackUrl" TEXT,
ADD COLUMN     "kycDocFrontUrl" TEXT,
ADD COLUMN     "kycDocType" "KycDocType",
ADD COLUMN     "kycIdLast4" TEXT,
ADD COLUMN     "kycLegalName" TEXT,
ADD COLUMN     "kycRejectedReason" TEXT,
ADD COLUMN     "kycReviewedAt" TIMESTAMP(3),
ADD COLUMN     "kycReviewedById" TEXT,
ADD COLUMN     "kycSelfieUrl" TEXT,
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "kycVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "trustComputedAt" TIMESTAMP(3),
ADD COLUMN     "trustScore" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "expoPushToken" TEXT;

-- CreateTable
CREATE TABLE "ShopStory" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaKind" "ShopStoryMediaKind" NOT NULL DEFAULT 'IMAGE',
    "caption" TEXT,
    "linkProductSlug" TEXT,
    "linkUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "openedByUserId" TEXT,
    "openedByName" TEXT NOT NULL,
    "openedByPhone" TEXT,
    "openedByLineId" TEXT,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopFavorite" (
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopFavorite_pkey" PRIMARY KEY ("userId","shopId")
);

-- CreateTable
CREATE TABLE "ShopFollow" (
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "notifyNew" BOOLEAN NOT NULL DEFAULT true,
    "notifyLive" BOOLEAN NOT NULL DEFAULT true,
    "notifySale" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopFollow_pkey" PRIMARY KEY ("userId","shopId")
);

-- CreateTable
CREATE TABLE "ProductView" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopStory_shopId_expiresAt_idx" ON "ShopStory"("shopId", "expiresAt");

-- CreateIndex
CREATE INDEX "ShopStory_expiresAt_idx" ON "ShopStory"("expiresAt");

-- CreateIndex
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopFavorite_userId_createdAt_idx" ON "ShopFavorite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopFavorite_shopId_createdAt_idx" ON "ShopFavorite"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopFollow_userId_createdAt_idx" ON "ShopFollow"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopFollow_shopId_createdAt_idx" ON "ShopFollow"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductView_userId_viewedAt_idx" ON "ProductView"("userId", "viewedAt");

-- CreateIndex
CREATE INDEX "ProductView_productId_viewedAt_idx" ON "ProductView"("productId", "viewedAt");

-- CreateIndex
CREATE INDEX "Shop_kycStatus_status_idx" ON "Shop"("kycStatus", "status");

-- CreateIndex
CREATE INDEX "Shop_trustScore_idx" ON "Shop"("trustScore");

-- AddForeignKey
ALTER TABLE "ShopStory" ADD CONSTRAINT "ShopStory_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopFavorite" ADD CONSTRAINT "ShopFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopFavorite" ADD CONSTRAINT "ShopFavorite_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopFollow" ADD CONSTRAINT "ShopFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopFollow" ADD CONSTRAINT "ShopFollow_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
