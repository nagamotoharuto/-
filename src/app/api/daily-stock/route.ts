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

// Staff set 発注数 for a sale date, normally on the previous business day.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, date, plannedQty } = body as {
      productId: string;
      date: string;
      plannedQty: number;
    };

    if (!productId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "productId と date が必要です" }, { status: 400 });
    }

    if (typeof plannedQty !== "number" || !Number.isInteger(plannedQty) || plannedQty < 0) {
      return NextResponse.json({ error: "発注数は0以上の整数で指定してください" }, { status: 400 });
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
    }

    const dailyStock = await db.dailyStock.upsert({
      where: { productId_date: { productId, date } },
      create: { productId, date, plannedQty },
      update: { plannedQty },
    });

    return NextResponse.json(dailyStock);
  } catch (error) {
    console.error("PATCH /api/daily-stock error:", error);
    return NextResponse.json({ error: "発注数の更新に失敗しました" }, { status: 500 });
  }
}
