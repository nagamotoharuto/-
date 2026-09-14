import { NextResponse } from "next/server";
import { releaseOverdueReservations } from "@/lib/availability";

// Sweeps every reservation that is past its pickup time by the grace period and
// was never collected, handing those items back to walk-up sale. The staff
// dashboard polls this while it is open; placing an order also triggers it.
export async function POST() {
  try {
    const released = await releaseOverdueReservations();
    return NextResponse.json({ released });
  } catch (error) {
    console.error("POST /api/orders/release error:", error);
    return NextResponse.json({ error: "予約の解放に失敗しました" }, { status: 500 });
  }
}
