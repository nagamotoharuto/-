-- カメラのAIカウントを廃止したため、書き込み手のないテーブルを落とす。
-- 売り切れ時刻は店頭在庫が0になった時点で DailyStock.soldOutAt に記録する。
DROP TABLE IF EXISTS "ShelfSnapshot";
