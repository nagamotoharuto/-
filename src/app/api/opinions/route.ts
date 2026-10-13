import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { grantStamps } from "@/lib/stamps";
import { OPINION_CATEGORIES, OPINION_MAX_LENGTH, toJstDateString } from "@/lib/utils";

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
 * ご意見そのものは匿名で、名前も区分も保存しない。送信元を辿れるものを
 * 持たないことで率直に書いてもらえるようにしている。
 *
 * お礼のスタンプを押すために名前だけは受け取るが、スタンプカードを更新
 * するのに使うだけで、ご意見の行には残さない。あとから突き合わせて誰が
 * 書いたかを調べることはできない。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, body: text, nickname } = body as {
      category?: string;
      body?: string;
      nickname?: string;
    };

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

    // お礼のスタンプは1日1回まで。何度も送って際限なく増やせないようにする。
    let stampAdded = false;
    let completedCards = 0;
    const name = (nickname ?? "").trim();

    if (name) {
      const today = toJstDateString();
      const card = await db.stampCard.findUnique({ where: { nickname: name } });
      if (card?.lastOpinionDate !== today) {
        const result = await grantStamps(name, 1, { lastOpinionDate: today });
        stampAdded = true;
        completedCards = result.completedNow;
      }
    }

    // 本文は返さない。投稿後に自分の送信内容が残る画面を作らないため。
    return NextResponse.json({ ok: true, stampAdded, completedCards }, { status: 201 });
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
