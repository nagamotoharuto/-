import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailability } from "@/lib/availability";
import { isBusinessDay, toJstDateString } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function jstMidnight(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+09:00`);
}

/**
 * コピー元になる過去の販売日を探す。
 *
 * ドリンクとお菓子はほぼ毎日同じなので「前営業日」、パンは曜日ごとに
 * 決まっているので「同じ曜日の前回」が使える。どちらも、発注数が
 * 1件でも入っている直近の日を遡って探す。
 */
async function findSourceDate(
  targetDate: string,
  mode: "previous" | "weekday"
): Promise<string | null> {
  const step = mode === "weekday" ? 7 : 1;
  let cursor = jstMidnight(targetDate);

  // 曜日指定なら8週間、前営業日なら約1か月ぶん遡れば十分
  const maxSteps = mode === "weekday" ? 8 : 30;

  for (let i = 0; i < maxSteps; i++) {
    cursor = new Date(cursor.getTime() - step * MS_PER_DAY);
    const iso = toJstDateString(cursor);
    if (mode === "previous" && !isBusinessDay(cursor)) continue;

    const count = await db.dailyStock.count({ where: { date: iso, plannedQty: { gt: 0 } } });
    if (count > 0) return iso;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, mode, from } = body as {
      date: string;
      mode?: "previous" | "weekday";
      from?: string;
    };

    if (!date || !DATE_RE.test(date)) {
      return NextResponse.json({ error: "date (YYYY-MM-DD) が必要です" }, { status: 400 });
    }

    const sourceDate =
      from && DATE_RE.test(from)
        ? from
        : await findSourceDate(date, mode === "weekday" ? "weekday" : "previous");

    if (!sourceDate) {
      return NextResponse.json(
        { error: "コピーできる過去の発注数が見つかりませんでした" },
        { status: 404 }
      );
    }

    const source = await db.dailyStock.findMany({
      where: { date: sourceDate, plannedQty: { gt: 0 } },
    });

    if (source.length === 0) {
      return NextResponse.json({ error: "コピー元に発注数がありません" }, { status: 404 });
    }

    // 発注数だけを写す。閉店残数や売り切れ時刻はその日限りの記録なので持ち込まない。
    for (const row of source) {
      await db.dailyStock.upsert({
        where: { productId_date: { productId: row.productId, date } },
        create: { productId: row.productId, date, plannedQty: row.plannedQty },
        update: { plannedQty: row.plannedQty },
      });
    }

    return NextResponse.json({
      sourceDate,
      copied: source.length,
      items: await getAvailability(date),
    });
  } catch (error) {
    console.error("POST /api/daily-stock/copy error:", error);
    return NextResponse.json({ error: "コピーに失敗しました" }, { status: 500 });
  }
}
