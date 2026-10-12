-- お客様からのご意見。匿名で受け取るため、送り主を特定する列は持たない。
CREATE TABLE "Opinion" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Opinion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Opinion_createdAt_idx" ON "Opinion"("createdAt");
