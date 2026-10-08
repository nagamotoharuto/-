import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compareProducts, isBusinessDay, toJstDateString } from "@/lib/utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// 同じ曜日をどこまで遡って探すか
const LOOKBACK_WEEKS = 8;

export interface WeeklyMenuDay {
  date: string;
  /** 0=日 〜 6=土 */
  weekday: number;
  isToday: boolean;
  isBusinessDay: boolean;
  /** その日の発注が実際に入っているか。false なら前回の同じ曜日から引いた目安。 */
  isConfirmed: boolean;
  /** 目安のときに参照した日 */
  sourceDate: string | null;
  items: { id: string; name: string; imageUrl: string; price: number }[];
}

function jstMidnight(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+09:00`);
}

function jstWeekday(isoDate: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" })
      .format(jstMidnight(isoDate))
      .replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/, (m) =>
        String(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(m))
      )
  );
}

/** 今週の月〜金の日付。週の区切りは月曜はじまり。 */
function thisWeekMonToFri(today: string): string[] {
  const wd = jstWeekday(today); // 0=日
  const offsetToMonday = wd === 0 ? -6 : 1 - wd;
  const monday = new Date(jstMidnight(today).getTime() + offsetToMonday * MS_PER_DAY);
  return Array.from({ length: 5 }, (_, i) =>
    toJstDateString(new Date(monday.getTime() + i * MS_PER_DAY))
  );
}

export async function GET() {
  try {
    const today = toJstDateString();
    const week = thisWeekMonToFri(today);

    // 同じ曜日を遡る分も含めて、必要な日付をまとめて引く
    const candidates = new Set<string>(week);
    for (const date of week) {
      for (let w = 1; w <= LOOKBACK_WEEKS; w++) {
        candidates.add(toJstDateString(new Date(jstMidnight(date).getTime() - w * 7 * MS_PER_DAY)));
      }
    }

    const stocks = await db.dailyStock.findMany({
      where: { date: { in: [...candidates] }, plannedQty: { gt: 0 } },
      include: { product: true },
    });

    // パンだけが対象。お菓子やドリンクは献立表に出さない。
    const breadByDate = new Map<string, typeof stocks>();
    for (const row of stocks) {
      if (row.product.subCategory !== "bread" || !row.product.isAvailable) continue;
      const list = breadByDate.get(row.date) ?? [];
      list.push(row);
      breadByDate.set(row.date, list);
    }

    const toItems = (rows: typeof stocks) =>
      rows
        .map((r) => r.product)
        .sort(compareProducts)
        .map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price }));

    const days: WeeklyMenuDay[] = week.map((date) => {
      const own = breadByDate.get(date);
      if (own?.length) {
        return {
          date,
          weekday: jstWeekday(date),
          isToday: date === today,
          isBusinessDay: isBusinessDay(jstMidnight(date)),
          isConfirmed: true,
          sourceDate: null,
          items: toItems(own),
        };
      }

      // 発注がまだ入っていない日は、前回の同じ曜日の品揃えを目安として出す
      for (let w = 1; w <= LOOKBACK_WEEKS; w++) {
        const past = toJstDateString(new Date(jstMidnight(date).getTime() - w * 7 * MS_PER_DAY));
        const rows = breadByDate.get(past);
        if (rows?.length) {
          return {
            date,
            weekday: jstWeekday(date),
            isToday: date === today,
            isBusinessDay: isBusinessDay(jstMidnight(date)),
            isConfirmed: false,
            sourceDate: past,
            items: toItems(rows),
          };
        }
      }

      return {
        date,
        weekday: jstWeekday(date),
        isToday: date === today,
        isBusinessDay: isBusinessDay(jstMidnight(date)),
        isConfirmed: false,
        sourceDate: null,
        items: [],
      };
    });

    return NextResponse.json({ today, days });
  } catch (error) {
    console.error("GET /api/weekly-menu error:", error);
    return NextResponse.json({ error: "献立表の取得に失敗しました" }, { status: 500 });
  }
}
