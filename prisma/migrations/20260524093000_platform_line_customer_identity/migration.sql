-- Platform-level @salepage LINE customer identity for anonymous buyers.
-- We keep the association on orders so public-token tracking continues to work,
-- while LINE "my orders" queries can be scoped by shopId in the backend.
ALTER TABLE "Order"
  ADD COLUMN "customerLineUserId" TEXT,
  ADD COLUMN "customerLineDisplayName" TEXT,
  ADD COLUMN "customerLinePictureUrl" TEXT,
  ADD COLUMN "lineLinkedAt" TIMESTAMP(3);

CREATE INDEX "Order_shopId_customerLineUserId_createdAt_idx"
  ON "Order"("shopId", "customerLineUserId", "createdAt");

CREATE INDEX "Order_customerLineUserId_createdAt_idx"
  ON "Order"("customerLineUserId", "createdAt");
