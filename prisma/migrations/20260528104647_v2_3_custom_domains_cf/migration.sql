/*
  Warnings:

  - You are about to drop the column `txtName` on the `ShopDomain` table. All the data in the column will be lost.
  - You are about to drop the column `txtValue` on the `ShopDomain` table. All the data in the column will be lost.
  - You are about to drop the column `vercelDomainId` on the `ShopDomain` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ShopDomain" DROP COLUMN "txtName",
DROP COLUMN "txtValue",
DROP COLUMN "vercelDomainId",
ADD COLUMN     "cfZoneId" TEXT;
