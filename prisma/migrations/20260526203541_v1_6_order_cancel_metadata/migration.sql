-- CreateEnum
CREATE TYPE "OrderCancelledBy" AS ENUM ('BUYER', 'SELLER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" "OrderCancelledBy";
