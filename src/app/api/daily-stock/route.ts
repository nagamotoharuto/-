import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailability } from "@/lib/availability";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date (YYYY-MM-DD) が必要です" }, { status: 400 });
    }

    return NextResponse.json({ date, items: await getAvailability(date) });
  } catch (error) {
    console.error("GET /api/daily-stock error:", error);
    return NextResponse.json({ error: "発注数の取得に失敗しました" }, { status: 500 });
  }
}

/**
 * Staff write a sale date's figures here: 発注数 before the day starts (normally
 * on the previous business day), and 閉店時の残数 once selling is over.
 *
 * Both are optional so the two moments can be saved independently.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, date, plannedQty, closingQty, shelfQty, shelfDelta } = body as {
      productId: string;
      date: string;
      plannedQty?: number;
      closingQty?: number | null;
      shelfQty?: number;
      shelfDelta?: number;
    };

    if (!productId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "productId と date が必要です" }, { status: 400 });
    }

    if (
      plannedQty === undefined &&
      closingQty === undefined &&
      shelfQty === undefined &&
      shelfDelta === undefined
    ) {
      return NextResponse.json({ error: "更新する項目がありません" }, { status: 400 });
    }

    if (
      plannedQty !== undefined &&
      (typeof plannedQty !== "number" || !Number.isInteger(plannedQty) || plannedQty < 0)
    ) {
      return NextResponse.json({ error: "発注数は0以上の整数で指定してください" }, { status: 400 });
    }

    if (
      closingQty !== undefined &&
      closingQty !== null &&
      (typeof closingQty !== "number" || !Number.isInteger(closingQty) || closingQty < 0)
    ) {
      return NextResponse.json({ error: "残数は0以上の整数で指定してください" }, { status: 400 });
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
    }

    const existing = await db.dailyStock.findUnique({
      where: { productId_date: { productId, date } },
    });
    const effectivePlanned = plannedQty ?? existing?.plannedQty ?? 0;

    // 店頭在庫は発注数と同じ数から始まる。まだ決まっていないときだけ発注数に合わせ、
    // すでに飛び込み販売で減っている場合は発注数を直しても巻き戻さない
    // （戻したいときは shelfQty を明示的に送る）。
    let nextShelfQty: number | undefined;
    if (shelfQty !== undefined) {
      nextShelfQty = Math.max(0, shelfQty);
    } else if (shelfDelta !== undefined) {
      nextShelfQty = Math.max(0, (existing?.shelfQty ?? effectivePlanned) + shelfDelta);
    } else if (plannedQty !== undefined && existing?.shelfQty == null) {
      nextShelfQty = plannedQty;
    }

    if (closingQty !== undefined && closingQty !== null && closingQty > effectivePlanned) {
      return NextResponse.json(
        { error: `残数が発注数(${effectivePlanned}個)を超えています` },
        { status: 400 }
      );
    }

    const dailyStock = await db.dailyStock.upsert({
      where: { productId_date: { productId, date } },
      create: {
        productId,
        date,
        plannedQty: effectivePlanned,
        shelfQty: nextShelfQty ?? null,
        closingQty: closingQty ?? null,
        closedAt: closingQty === undefined || closingQty === null ? null : new Date(),
      },
      update: {
        ...(plannedQty !== undefined ? { plannedQty } : {}),
        ...(nextShelfQty !== undefined ? { shelfQty: nextShelfQty } : {}),
        ...(closingQty !== undefined
          ? {
              closingQty,
              closedAt: closingQty === null ? null : new Date(),
            }
          : {}),
      },
    });

    return NextResponse.json(dailyStock);
  } catch (error) {
    console.error("PATCH /api/daily-stock error:", error);
    return NextResponse.json({ error: "発注数の更新に失敗しました" }, { status: 500 });
  }
}
