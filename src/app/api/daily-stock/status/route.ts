import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isBread } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 一度に聞ける販売日の数。画面で先の営業日を並べるぶんに足りればよい。
const MAX_DATES = 14;

/**
 * 指定した販売日に、パンの発注数がもう入っているかどうかだけを返す。
 *
 * 先の営業日を選ぶボタンに「入力済」の印を出すために使う。ドリンクと
 * お菓子は前回の数を自動で引き継ぐので、入ったかどうかの判断からは
 * 外している。入れたかどうかが日ごとに変わるのはパンだけ。
 *
 * 発注数の取得(GET /api/daily-stock)と違い、行を作る副作用がない。
 * 印を出すためだけに、まだ開いてもいない日のデータを増やさないため。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dates = (searchParams.get("dates") ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter((d) => DATE_RE.test(d))
      .slice(0, MAX_DATES);

    if (dates.length === 0) {
      return NextResponse.json({ error: "dates (YYYY-MM-DD,...) が必要です" }, { status: 400 });
    }

    const [products, rows] = await Promise.all([
      db.product.findMany({ select: { id: true, category: true, subCategory: true } }),
      db.dailyStock.findMany({
        where: { date: { in: dates }, plannedQty: { gt: 0 } },
        select: { date: true, productId: true },
      }),
    ]);

    const breadIds = new Set(products.filter(isBread).map((p) => p.id));

    const filled: Record<string, number> = {};
    for (const d of dates) filled[d] = 0;
    for (const row of rows) {
      if (breadIds.has(row.productId)) filled[row.date] += 1;
    }

    return NextResponse.json({ filled });
  } catch (error) {
    console.error("GET /api/daily-stock/status error:", error);
    return NextResponse.json({ error: "入力状況の取得に失敗しました" }, { status: 500 });
  }
}
