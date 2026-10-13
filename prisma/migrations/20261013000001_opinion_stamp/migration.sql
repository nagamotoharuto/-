-- ご意見を送ってくださった方にもスタンプを1つ押す。
-- 何度も送って際限なく増やせないよう、1日1回までに絞るための控え。
ALTER TABLE "StampCard" ADD COLUMN "lastOpinionDate" TEXT NOT NULL DEFAULT '';
