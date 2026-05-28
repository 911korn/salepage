-- CreateEnum
CREATE TYPE "PaymentGatewayProvider" AS ENUM ('OMISE', 'STRIPE', 'C2P', 'GBPRIMEPAY', 'PAYSOLUTIONS', 'KBANK', 'SCB', 'KRUNGSRI', 'TRUEMONEY', 'RABBIT_LINEPAY', 'PAYPAL');

-- CreateEnum
CREATE TYPE "PaymentGatewayMode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "PaymentGatewayTestStatus" AS ENUM ('OK', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "ShopPaymentGateway" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKeyEncrypted" TEXT NOT NULL,
    "webhookSecretEncrypted" TEXT,
    "mode" "PaymentGatewayMode" NOT NULL DEFAULT 'TEST',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" "PaymentGatewayTestStatus",
    "lastTestMessage" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPaymentGateway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopPaymentGateway_shopId_idx" ON "ShopPaymentGateway"("shopId");

-- CreateIndex
CREATE INDEX "ShopPaymentGateway_provider_idx" ON "ShopPaymentGateway"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPaymentGateway_shopId_provider_key" ON "ShopPaymentGateway"("shopId", "provider");

-- AddForeignKey
ALTER TABLE "ShopPaymentGateway" ADD CONSTRAINT "ShopPaymentGateway_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
