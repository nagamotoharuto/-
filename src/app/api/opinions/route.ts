import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OPINION_CATEGORIES, OPINION_MAX_LENGTH } from "@/lib/utils";

/** スタッフ向け。新しい順にまとめて返す。 */
export async function GET() {
  try {
    const opinions = await db.opinion.findMany({ orderBy: { createdAt: "desc" } });
    const unreadCount = opinions.filter((o) => o.readAt === null).length;
    return NextResponse.json({ opinions, unreadCount });
  } catch (error) {
    console.error("GET /api/opinions error:", error);
    return NextResponse.json({ error: "ご意見の取得に失敗しました" }, { status: 500 });
  }
}

/**
 * お客様からの投稿。
 *
 * 匿名で受け取るため、名前もメールも区分も保存しない。送信元を辿れる
 * ものを持たないことで、率直に書いてもらえるようにしている。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, body: text } = body as { category?: string; body?: string };

    const trimmed = (text ?? "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "ご意見を入力してください" }, { status: 400 });
    }
    if (trimmed.length > OPINION_MAX_LENGTH) {
      return NextResponse.json(
        { error: `${OPINION_MAX_LENGTH}文字以内でお願いします` },
        { status: 400 }
      );
    }

    const safeCategory = (OPINION_CATEGORIES as readonly string[]).includes(category ?? "")
      ? (category as string)
      : "other";

    await db.opinion.create({ data: { category: safeCategory, body: trimmed } });

    // 本文は返さない。投稿後に自分の送信内容が残る画面を作らないため。
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/opinions error:", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}

/** スタッフが目を通したことを記録する。未読の件数を正しく出すため。 */
export async function PATCH() {
  try {
    const result = await db.opinion.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ marked: result.count });
  } catch (error) {
    console.error("PATCH /api/opinions error:", error);
    return NextResponse.json({ error: "既読の記録に失敗しました" }, { status: 500 });
  }
}
