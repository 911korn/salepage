-- Shipping workflow foundation for SalePage dashboard orders.
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerShipmentId" TEXT,
    "courierCode" TEXT NOT NULL,
    "courierName" TEXT NOT NULL,
    "serviceName" TEXT,
    "handoff" TEXT NOT NULL DEFAULT 'DROPOFF',
    "status" TEXT NOT NULL DEFAULT 'READY_TO_SHIP',
    "trackingNumber" TEXT,
    "labelUrl" TEXT,
    "senderName" TEXT,
    "senderPhone" TEXT,
    "senderAddress" TEXT,
    "senderPostcode" TEXT,
    "receiverName" TEXT NOT NULL,
    "receiverPhone" TEXT,
    "receiverAddress" TEXT,
    "receiverPostcode" TEXT,
    "parcelWeightGram" INTEGER,
    "parcelWidthCm" INTEGER,
    "parcelLengthCm" INTEGER,
    "parcelHeightCm" INTEGER,
    "shippingFeeSatang" INTEGER,
    "codAmountSatang" INTEGER,
    "note" TEXT,
    "bookedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");
CREATE INDEX "Shipment_shopId_status_createdAt_idx" ON "Shipment"("shopId", "status", "createdAt");
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Anonymous checkout address memory, scoped per shop + normalized phone.
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "label" TEXT,
    "address" TEXT NOT NULL,
    "addressKey" TEXT NOT NULL,
    "postcode" TEXT,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAddress_shopId_customerPhone_addressKey_key"
  ON "CustomerAddress"("shopId", "customerPhone", "addressKey");
CREATE INDEX "CustomerAddress_shopId_customerPhone_lastUsedAt_idx"
  ON "CustomerAddress"("shopId", "customerPhone", "lastUsedAt");

ALTER TABLE "CustomerAddress"
  ADD CONSTRAINT "CustomerAddress_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
