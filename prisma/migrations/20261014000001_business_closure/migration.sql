-- 臨時の営業終了。15時を待たずに店じまいした日を記録する。
CREATE TABLE "BusinessClosure" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessClosure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessClosure_date_key" ON "BusinessClosure"("date");
