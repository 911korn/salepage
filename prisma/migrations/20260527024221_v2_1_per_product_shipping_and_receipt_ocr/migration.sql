-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "labelGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "shippingReceiptScannedAt" TIMESTAMP(3),
ADD COLUMN     "shippingReceiptUrl" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shippingFeeSatang" INTEGER NOT NULL DEFAULT 0;
