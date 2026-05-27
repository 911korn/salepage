-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "digitalFulfilledAt" TIMESTAMP(3),
ADD COLUMN     "digitalFulfillment" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "digitalContent" TEXT;
