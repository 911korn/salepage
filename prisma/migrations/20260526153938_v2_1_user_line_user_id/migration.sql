-- Add lineUserId to User (LINE Messaging API push target).
ALTER TABLE "User" ADD COLUMN "lineUserId" TEXT;
CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");
