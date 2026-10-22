import { db } from "@/lib/db";
import { toJstDateString } from "@/lib/utils";

// 何日先まで休みを見るか。先の営業日の入力が4日先までなので、
// そこを含めて数週間ぶんあれば足りる。
const LOOKAHEAD_DAYS = 60;

/**
 * 休みにした販売日の一覧。
 *
 * 土日祝は曜日から分かるが、急な中止で休みにした日はここにしかない。
 * 次の営業日を出す場面では、この一覧を渡して飛ばしてもらう。
 *
 * 過去の休みは数えない。次がいつかを決めるのに要らないうえ、
 * 一覧が際限なく伸びるのを避けるため。
 */
export async function getClosedDates(from: Date = new Date()): Promise<Set<string>> {
  const start = toJstDateString(from);
  const end = toJstDateString(new Date(from.getTime() + LOOKAHEAD_DAYS * 86400_000));
  return getClosedDatesInRange(start, end);
}

/**
 * 指定した範囲の休みの一覧。
 *
 * 過去に遡ってコピー元の営業日を探す場面など、先を見るだけでは
 * 足りないときに使う。
 */
export async function getClosedDatesInRange(from: string, to: string): Promise<Set<string>> {
  const rows = await db.businessClosure.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true },
  });

  return new Set(rows.map((r) => r.date));
}
