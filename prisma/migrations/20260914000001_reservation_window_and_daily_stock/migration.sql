-- 販売日ごとの発注数（予約枠の基準になる計画生産数）
CREATE TABLE "DailyStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "plannedQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyStock_productId_date_key" ON "DailyStock"("productId", "date");
CREATE INDEX "DailyStock_date_idx" ON "DailyStock"("date");

ALTER TABLE "DailyStock"
  ADD CONSTRAINT "DailyStock_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 受け取り日（前営業日からの予約に対応するため）と自動解放の記録
ALTER TABLE "Order"
  ADD COLUMN "pickupDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "releasedAt" TIMESTAMP(3);

-- 既存の予約は当日受け取りだったので、作成日(JST)を受け取り日として埋める
UPDATE "Order"
SET "pickupDate" = to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD')
WHERE "pickupDate" = '';

CREATE INDEX "Order_pickupDate_idx" ON "Order"("pickupDate");

-- 既存商品の在庫を、当日の発注数の初期値として引き継ぐ
INSERT INTO "DailyStock" ("id", "productId", "date", "plannedQty", "createdAt", "updatedAt")
SELECT
  'ds_' || "id" || '_' || to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'), 'YYYYMMDD'),
  "id",
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'), 'YYYY-MM-DD'),
  "stock",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product"
ON CONFLICT ("productId", "date") DO NOTHING;
