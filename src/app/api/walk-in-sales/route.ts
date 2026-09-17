import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailability, syncSoldOutAt } from "@/lib/availability";
import { toJstDateString } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? toJstDateString();
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: "date は YYYY-MM-DD で指定してください" }, { status: 400 });
    }

    const sales = await db.walkInSale.findMany({
      where: { date },
      orderBy: { soldAt: "desc" },
      include: { product: { select: { name: true, category: true, subCategory: true } } },
    });

    return NextResponse.json({ date, sales });
  } catch (error) {
    console.error("GET /api/walk-in-sales error:", error);
    return NextResponse.json({ error: "販売記録の取得に失敗しました" }, { status: 500 });
  }
}

/** 「1個売れた」を押したときの記録。単価は売った時点のものを写して残す。 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, date, quantity } = body as {
      productId: string;
      date?: string;
      quantity?: number;
    };
    const saleDate = date && DATE_RE.test(date) ? date : toJstDateString();

    if (!productId) {
      return NextResponse.json({ error: "productId が必要です" }, { status: 400 });
    }

    const qty = Number.isInteger(quantity) && (quantity as number) > 0 ? (quantity as number) : 1;

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
    }

    // 棚にある以上は売れない。押し間違いで残数が負にならないよう止める。
    const availability = await getAvailability(saleDate);
    const current = availability.find((a) => a.id === productId);
    if (!current || current.remainingStock < qty) {
      return NextResponse.json(
        { error: `「${product.name}」の店頭在庫が残っていません` },
        { status: 400 }
      );
    }

    await db.walkInSale.create({
      data: { productId, date: saleDate, quantity: qty, price: product.price },
    });
    await syncSoldOutAt(saleDate, productId);

    const updated = await getAvailability(saleDate);
    return NextResponse.json({ item: updated.find((a) => a.id === productId) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/walk-in-sales error:", error);
    return NextResponse.json({ error: "記録に失敗しました" }, { status: 500 });
  }
}

/** 押し間違いの取り消し。直近の1件、または指定商品の当日分すべてを消す。 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const date = searchParams.get("date") ?? toJstDateString();
    const all = searchParams.get("all") === "true";

    if (!productId || !DATE_RE.test(date)) {
      return NextResponse.json({ error: "productId と date が必要です" }, { status: 400 });
    }

    if (all) {
      await db.walkInSale.deleteMany({ where: { productId, date } });
    } else {
      const latest = await db.walkInSale.findFirst({
        where: { productId, date },
        orderBy: { soldAt: "desc" },
      });
      if (latest) await db.walkInSale.delete({ where: { id: latest.id } });
    }

    await syncSoldOutAt(date, productId);

    const updated = await getAvailability(date);
    return NextResponse.json({ item: updated.find((a) => a.id === productId) });
  } catch (error) {
    console.error("DELETE /api/walk-in-sales error:", error);
    return NextResponse.json({ error: "取り消しに失敗しました" }, { status: 500 });
  }
}
