-- CreateTable
CREATE TABLE "MobileAuthBridge" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "token" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAuthBridge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobileAuthBridge_expiresAt_idx" ON "MobileAuthBridge"("expiresAt");

-- CreateIndex
CREATE INDEX "MobileAuthBridge_userId_idx" ON "MobileAuthBridge"("userId");

-- AddForeignKey
ALTER TABLE "MobileAuthBridge" ADD CONSTRAINT "MobileAuthBridge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
