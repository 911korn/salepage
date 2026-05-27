-- CreateEnum
CREATE TYPE "ContentReportKind" AS ENUM ('SHOP', 'PRODUCT', 'REVIEW', 'STORY', 'LIVE_COMMENT');

-- CreateEnum
CREATE TYPE "ContentReportReason" AS ENUM ('SPAM', 'INAPPROPRIATE', 'COUNTERFEIT', 'HARASSMENT', 'ILLEGAL', 'MISLEADING', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED_REMOVED', 'RESOLVED_KEPT', 'DUPLICATE');

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "kind" "ContentReportKind" NOT NULL,
    "shopId" TEXT,
    "productId" TEXT,
    "reviewId" TEXT,
    "storyId" TEXT,
    "liveCommentId" TEXT,
    "reason" "ContentReportReason" NOT NULL,
    "note" TEXT,
    "status" "ContentReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentReport_reporterId_createdAt_idx" ON "ContentReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentReport_kind_status_idx" ON "ContentReport"("kind", "status");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockeeId_key" ON "UserBlock"("blockerId", "blockeeId");

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockeeId_fkey" FOREIGN KEY ("blockeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
