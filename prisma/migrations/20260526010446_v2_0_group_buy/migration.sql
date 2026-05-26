-- CreateEnum
CREATE TYPE "GroupBuyStatus" AS ENUM ('ACTIVE', 'FILLED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "GroupBuy" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "minQty" INTEGER NOT NULL,
    "maxQty" INTEGER,
    "currentQty" INTEGER NOT NULL DEFAULT 0,
    "tiers" JSONB NOT NULL DEFAULT '[]',
    "deadline" TIMESTAMP(3) NOT NULL,
    "filledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "status" "GroupBuyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupBuy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBuyMember" (
    "id" TEXT NOT NULL,
    "groupBuyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "priceLockedSatang" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupBuyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupBuy_shopId_status_deadline_idx" ON "GroupBuy"("shopId", "status", "deadline");

-- CreateIndex
CREATE INDEX "GroupBuy_status_deadline_idx" ON "GroupBuy"("status", "deadline");

-- CreateIndex
CREATE INDEX "GroupBuy_productId_status_idx" ON "GroupBuy"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBuyMember_orderId_key" ON "GroupBuyMember"("orderId");

-- CreateIndex
CREATE INDEX "GroupBuyMember_groupBuyId_createdAt_idx" ON "GroupBuyMember"("groupBuyId", "createdAt");

-- AddForeignKey
ALTER TABLE "GroupBuy" ADD CONSTRAINT "GroupBuy_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBuy" ADD CONSTRAINT "GroupBuy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBuyMember" ADD CONSTRAINT "GroupBuyMember_groupBuyId_fkey" FOREIGN KEY ("groupBuyId") REFERENCES "GroupBuy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBuyMember" ADD CONSTRAINT "GroupBuyMember_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
