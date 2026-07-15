-- CreateTable
CREATE TABLE "PackState" (
    "userId" TEXT NOT NULL,
    "lastFreePackAt" TIMESTAMP(3),
    "extraPacks" INTEGER NOT NULL DEFAULT 0,
    "loginStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCheckIn" TIMESTAMP(3),

    CONSTRAINT "PackState_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "PackState" ADD CONSTRAINT "PackState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
