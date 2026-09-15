import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJstDateString } from "@/lib/utils";

// 飛び込み客の売り切れ遭遇。アプリからは観測できないため販売員が1件ずつ記録する。
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? toJstDateString();

    const entries = await db.soldOutTurnaway.findMany({
      where: { date },
      orderBy: { recordedAt: "desc" },
    });

    return NextResponse.json({ date, count: entries.length, entries });
  } catch (error) {
    console.error("GET /api/turnaway error:", error);
    return NextResponse.json({ error: "記録の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { date, productName } = body as { date?: string; productName?: string };
    const saleDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toJstDateString();

    const entry = await db.soldOutTurnaway.create({
      data: { date: saleDate, productName: productName?.trim() ?? "" },
    });
    const count = await db.soldOutTurnaway.count({ where: { date: saleDate } });

    return NextResponse.json({ entry, count }, { status: 201 });
  } catch (error) {
    console.error("POST /api/turnaway error:", error);
    return NextResponse.json({ error: "記録に失敗しました" }, { status: 500 });
  }
}

// 直近1件の取り消し（押し間違い用）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? toJstDateString();

    const latest = await db.soldOutTurnaway.findFirst({
      where: { date },
      orderBy: { recordedAt: "desc" },
    });
    if (latest) await db.soldOutTurnaway.delete({ where: { id: latest.id } });

    const count = await db.soldOutTurnaway.count({ where: { date } });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("DELETE /api/turnaway error:", error);
    return NextResponse.json({ error: "取り消しに失敗しました" }, { status: 500 });
  }
}
