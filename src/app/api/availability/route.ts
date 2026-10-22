import { NextRequest, NextResponse } from "next/server";
import { ensureCarryOver, getAvailability, releaseOverdueReservations } from "@/lib/availability";
import { getReservableDates } from "@/lib/utils";
import { getClosedDates } from "@/lib/closures";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date (YYYY-MM-DD) が必要です" }, { status: 400 });
    }

    // Free up no-show slots first so the menu shows what is genuinely bookable
    await releaseOverdueReservations();
    // ドリンクとお菓子は前回の数をそのまま引き継ぐ
    await ensureCarryOver(date);

    const items = await getAvailability(date);
    return NextResponse.json({
      date,
      reservableDates: getReservableDates(new Date(), false, await getClosedDates()),
      items,
    });
  } catch (error) {
    console.error("GET /api/availability error:", error);
    return NextResponse.json({ error: "予約枠の取得に失敗しました" }, { status: 500 });
  }
}
