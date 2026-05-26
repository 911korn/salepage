-- CreateTable
CREATE TABLE "EmailLoginOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "requestIp" TEXT,
    "requestUa" TEXT,

    CONSTRAINT "EmailLoginOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLoginOtp_email_createdAt_idx" ON "EmailLoginOtp"("email", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLoginOtp_expiresAt_idx" ON "EmailLoginOtp"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailLoginOtp_userId_idx" ON "EmailLoginOtp"("userId");

-- AddForeignKey
ALTER TABLE "EmailLoginOtp" ADD CONSTRAINT "EmailLoginOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
