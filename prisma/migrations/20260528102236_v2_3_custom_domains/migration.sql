-- CreateEnum
CREATE TYPE "ShopDomainStatus" AS ENUM ('PENDING_DNS', 'VERIFYING', 'VERIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "ShopDomain" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "ns1" TEXT,
    "ns2" TEXT,
    "txtName" TEXT,
    "txtValue" TEXT,
    "status" "ShopDomainStatus" NOT NULL DEFAULT 'PENDING_DNS',
    "failedReason" TEXT,
    "vercelDomainId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopDomain_domain_key" ON "ShopDomain"("domain");

-- CreateIndex
CREATE INDEX "ShopDomain_shopId_idx" ON "ShopDomain"("shopId");

-- CreateIndex
CREATE INDEX "ShopDomain_status_lastCheckedAt_idx" ON "ShopDomain"("status", "lastCheckedAt");

-- AddForeignKey
ALTER TABLE "ShopDomain" ADD CONSTRAINT "ShopDomain_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
