-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'DISPUTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "escrowFeeSatang" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "useEscrow" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "acceptsEscrow" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EscrowHold" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "feeSatang" INTEGER NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "scheduledReleaseAt" TIMESTAMP(3),
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscrowHold_orderId_key" ON "EscrowHold"("orderId");

-- CreateIndex
CREATE INDEX "EscrowHold_status_scheduledReleaseAt_idx" ON "EscrowHold"("status", "scheduledReleaseAt");

-- CreateIndex
CREATE INDEX "EscrowHold_status_heldAt_idx" ON "EscrowHold"("status", "heldAt");

-- AddForeignKey
ALTER TABLE "EscrowHold" ADD CONSTRAINT "EscrowHold_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
