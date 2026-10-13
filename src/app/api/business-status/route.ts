import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getReservableDate, isWithinSalesHours, toJstDateString } from "@/lib/utils";

/** 今日が臨時に店じまいされているか。 */
export async function isClosedToday(now: Date = new Date()): Promise<boolean> {
  const row = await db.businessClosure.findUnique({ where: { date: toJstDateString(now) } });
  return row !== null;
}

export async function GET() {
  try {
    const today = toJstDateString();
    const closed = await isClosedToday();

    return NextResponse.json({
      today,
      closedToday: closed,
      // 画面はこの日付を見て動く。臨時終了なら次の営業日に進んでいる。
      reservableDate: getReservableDate(new Date(), closed),
      counterOpen: !closed && isWithinSalesHours(),
    });
  } catch (error) {
    console.error("GET /api/business-status error:", error);
    return NextResponse.json({ error: "営業状況の取得に失敗しました" }, { status: 500 });
  }
}

/**
 * 臨時に営業を終了する。
 *
 * その日の新規予約を止め、受付を次の営業日へ進める。すでに入っている
 * 予約は消さない。来店されたら渡すか、解放して店頭に戻す。
 * 15時を過ぎれば通常どおり翌営業日の受付になるので、後片付けは要らない。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { date } = body as { date?: string };
    const target = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toJstDateString();

    await db.businessClosure.upsert({
      where: { date: target },
      create: { date: target },
      update: {},
    });

    return NextResponse.json({
      closedToday: true,
      reservableDate: getReservableDate(new Date(), target === toJstDateString()),
    });
  } catch (error) {
    console.error("POST /api/business-status error:", error);
    return NextResponse.json({ error: "営業終了の記録に失敗しました" }, { status: 500 });
  }
}

/** 間違えて終了したときに戻す。 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? toJstDateString();

    await db.businessClosure.deleteMany({ where: { date } });

    const closed = await isClosedToday();
    return NextResponse.json({
      closedToday: closed,
      reservableDate: getReservableDate(new Date(), closed),
    });
  } catch (error) {
    console.error("DELETE /api/business-status error:", error);
    return NextResponse.json({ error: "取り消しに失敗しました" }, { status: 500 });
  }
}
