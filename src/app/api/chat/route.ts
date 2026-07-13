import { NextRequest } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";

const CATEGORY_JA: Record<string, string> = {
  bread: "パン",
  drink: "ドリンク",
  goods: "グッズ",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[chat] OPENAI_API_KEY is not set");
    return Response.json({ error: "OPENAI_API_KEY が設定されていません" }, { status: 500 });
  }

  let body: { message?: string; nickname?: string; history?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  const { message, nickname, history = [] } = body;
  if (!message?.trim()) {
    return Response.json({ error: "メッセージが空です" }, { status: 400 });
  }

  // Fetch available products
  let products: { name: string; category: string; price: number; description: string }[] = [];
  try {
    products = await db.product.findMany({
      where: { isAvailable: true, stock: { gt: 0 } },
      select: { name: true, category: true, price: true, description: true },
      orderBy: { category: "asc" },
    });
  } catch (err) {
    console.error("[chat] DB product query failed:", err);
  }

  // Fetch user order history
  let pastProductNames: string[] = [];
  if (nickname) {
    try {
      const orders = await db.order.findMany({
        where: { nickname },
        select: { items: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      pastProductNames = orders.flatMap((o) => o.items.map((i) => i.name));
    } catch (err) {
      console.error("[chat] DB order query failed:", err);
    }
  }

  const productList =
    products.length > 0
      ? products
          .map((p) => `・${p.name}（${CATEGORY_JA[p.category] ?? p.category}）¥${p.price} ${p.description}`)
          .join("\n")
      : "現在販売中の商品はありません";

  const historyText =
    pastProductNames.length > 0
      ? `これまでに注文したことがある商品：${[...new Set(pastProductNames)].join("、")}`
      : "注文履歴なし";

  const systemPrompt = `あなたはUniversity Bakeryの親切なおすすめアシスタント「ベーカリーくん」です。
ユーザーの好みや過去の注文履歴をもとに、現在販売中の商品をおすすめします。

【現在販売中の商品（在庫あり）】
${productList}

【${nickname ? `${nickname}さん` : "このお客様"}の情報】
${historyText}

【返答ルール】
- 上記「現在販売中の商品」の中からのみすすめてください
- 2〜3品を具体的に紹介してください（商品名・価格・おすすめポイント）
- ユーザーの好みのキーワードに合わせて選んでください
- 商品名は「」で囲んでください
- フレンドリーで親しみやすい日本語、200字以内でまとめてください`;

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-6).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ],
      max_tokens: 400,
      temperature: 0.75,
    });

    const content =
      completion.choices[0]?.message?.content?.trim() ?? "おすすめを提案できませんでした。";

    return Response.json({ content });
  } catch (err) {
    console.error("[chat] OpenAI error:", err);
    const message =
      err instanceof Error ? err.message : "OpenAI APIの呼び出しに失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
