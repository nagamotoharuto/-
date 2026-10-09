-- 満了したスタンプカードを1枚ずつ残す。特典は製作者が個別に渡すため、
-- お客様があとから何枚ためたかを見せられるようにする。
CREATE TABLE "StampCardCompletion" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "cardNumber" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampCardCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StampCardCompletion_nickname_idx" ON "StampCardCompletion"("nickname");

ALTER TABLE "StampCardCompletion"
  ADD CONSTRAINT "StampCardCompletion_nickname_fkey"
  FOREIGN KEY ("nickname") REFERENCES "StampCard"("nickname") ON DELETE CASCADE ON UPDATE CASCADE;

-- 特典が「パン1品無料」から「製作者への連絡」に変わったため、
-- 未使用の無料権を保持する列は不要になる。
ALTER TABLE "StampCard" DROP COLUMN "freeItemAvailable";

-- 区分の「看護生」を「専門学生」に改める。
UPDATE "Order" SET "userType" = 'vocational' WHERE "userType" = 'nursing';
