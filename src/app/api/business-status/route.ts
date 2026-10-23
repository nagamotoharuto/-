import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClosedDates } from "@/lib/closures";
import { getReservableDate, isWithinSalesHours, toJstDateString } from "@/lib/utils";
import { requireStaff } from "@/lib/staffAuth";

/** 今日が臨時に店じまいされているか。 */
export async function isClosedToday(now: Date = new Date()): Promise<boolean> {
  const row = await db.businessClosure.findUnique({ where: { date: toJstDateString(now) } });
  return row !== null;
}

export async function GET() {
  try {
    const today = toJstDateString();
    const closedDates = await getClosedDates();
    const closed = closedDates.has(today);

    return NextResponse.json({
      today,
      closedToday: closed,
      // 画面はこの日付を見て動く。臨時終了や休みにした日は飛ばしてある。
      reservableDate: getReservableDate(new Date(), closed, closedDates),
      counterOpen: !closed && isWithinSalesHours(new Date(), closedDates),
      // 先の休み。画面側で次の営業日を出すときに使う。
      closedDates: [...closedDates].sort(),
    });
  } catch (error) {
    console.error("GET /api/business-status error:", error);
    return NextResponse.json({ error: "営業状況の取得に失敗しました" }, { status: 500 });
  }
}

/**
 * 販売日を休みにする。
 *
 * 日付を渡さなければ今日を臨時終了する。その日の新規予約を止め、受付を
 * 次の営業日へ進める。すでに入っている予約は消さない。来店されたら渡すか、
 * 解放して店頭に戻す。
 *
 * 先の日付を渡せば、その日を休みとして登録する。急に中止が決まった日を
 * 飛ばして次の営業日を出すために使う。
 */
export async function POST(request: NextRequest) {
  const denied = requireStaff(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const { date } = body as { date?: string };
    const target = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toJstDateString();

    await db.businessClosure.upsert({
      where: { date: target },
      create: { date: target },
      update: {},
    });

    const closedDates = await getClosedDates();
    const today = toJstDateString();

    return NextResponse.json({
      date: target,
      closedToday: closedDates.has(today),
      reservableDate: getReservableDate(new Date(), closedDates.has(today), closedDates),
      closedDates: [...closedDates].sort(),
    });
  } catch (error) {
    console.error("POST /api/business-status error:", error);
    return NextResponse.json({ error: "営業終了の記録に失敗しました" }, { status: 500 });
  }
}

/** 間違えて終了したときに戻す。 */
export async function DELETE(request: NextRequest) {
  const denied = requireStaff(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? toJstDateString();

    await db.businessClosure.deleteMany({ where: { date } });

    const closedDates = await getClosedDates();
    const closed = closedDates.has(toJstDateString());
    return NextResponse.json({
      date,
      closedToday: closed,
      reservableDate: getReservableDate(new Date(), closed, closedDates),
      closedDates: [...closedDates].sort(),
    });
  } catch (error) {
    console.error("DELETE /api/business-status error:", error);
    return NextResponse.json({ error: "取り消しに失敗しました" }, { status: 500 });
  }
}
