-- 売り場の区分を food / drink / goods の3つに統合する。
-- パンとお菓子はどちらも food だが、図鑑・購入上限・スタンプ特典・AIカウントは
-- パンだけが対象なので、内訳を subCategory に残す。
ALTER TABLE "Product" ADD COLUMN "subCategory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrderItem" ADD COLUMN "subCategory" TEXT NOT NULL DEFAULT '';

UPDATE "Product" SET "subCategory" = 'bread', "category" = 'food' WHERE "category" = 'bread';
UPDATE "OrderItem" SET "subCategory" = 'bread', "category" = 'food' WHERE "category" = 'bread';

-- 店頭在庫（発注数と同じ数から始め、飛び込み販売のたびに減らす）
ALTER TABLE "DailyStock" ADD COLUMN "shelfQty" INTEGER;
