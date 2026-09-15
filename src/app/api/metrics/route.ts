import { NextRequest, NextResponse } from "next/server";
import { getMetrics } from "@/lib/metrics";
import { toJstDateString } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const today = toJstDateString();
    const from = searchParams.get("from") ?? today;
    const to = searchParams.get("to") ?? today;

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ error: "from / to は YYYY-MM-DD で指定してください" }, { status: 400 });
    }

    return NextResponse.json({ from, to, days: await getMetrics(from, to) });
  } catch (error) {
    console.error("GET /api/metrics error:", error);
    return NextResponse.json({ error: "集計に失敗しました" }, { status: 500 });
  }
}
