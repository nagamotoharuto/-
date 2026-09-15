-- 閉店時の残数と売り切れ時刻（実売数・飛び込み販売数・売り切れ時刻の算出用）
ALTER TABLE "DailyStock"
  ADD COLUMN "closingQty" INTEGER,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "soldOutAt" TIMESTAMP(3);

-- カメラのAIカウントの時系列
CREATE TABLE "ShelfSnapshot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShelfSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShelfSnapshot_date_idx" ON "ShelfSnapshot"("date");
CREATE INDEX "ShelfSnapshot_productId_date_idx" ON "ShelfSnapshot"("productId", "date");

-- 飛び込み客の売り切れ遭遇（販売員が手入力）
CREATE TABLE "SoldOutTurnaway" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoldOutTurnaway_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SoldOutTurnaway_date_idx" ON "SoldOutTurnaway"("date");
