-- 飛び込み販売を1件ずつ記録する。店頭の残数・売上金・販売個数をここから導くため、
-- 残数だけを持っていた DailyStock.shelfQty は不要になる。
CREATE TABLE "WalkInSale" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" INTEGER NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalkInSale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WalkInSale_date_idx" ON "WalkInSale"("date");
CREATE INDEX "WalkInSale_productId_date_idx" ON "WalkInSale"("productId", "date");

ALTER TABLE "WalkInSale"
  ADD CONSTRAINT "WalkInSale_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- これまでの店頭在庫の減りは飛び込み販売だったので、1件ずつの記録に置き換える。
-- 正確な時刻は残っていないため、その行の最終更新時刻を販売時刻として入れる。
INSERT INTO "WalkInSale" ("id", "productId", "date", "quantity", "price", "soldAt")
SELECT
  'wis_' || d."id" || '_' || g.n,
  d."productId",
  d."date",
  1,
  p."price",
  d."updatedAt"
FROM "DailyStock" d
JOIN "Product" p ON p."id" = d."productId"
CROSS JOIN LATERAL generate_series(1, GREATEST(0, d."plannedQty" - d."shelfQty")) AS g(n)
WHERE d."shelfQty" IS NOT NULL AND d."plannedQty" > d."shelfQty";

ALTER TABLE "DailyStock" DROP COLUMN "shelfQty";
