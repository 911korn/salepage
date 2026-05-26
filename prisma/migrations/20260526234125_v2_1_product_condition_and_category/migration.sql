-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'PRE_OWNED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "condition" "ProductCondition" NOT NULL DEFAULT 'NEW';
