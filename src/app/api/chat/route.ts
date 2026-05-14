import { NextRequest } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY が設定されていません" }, { status: 500 });
  }

  const { message, nickname, history } = (await req.json()) as {
    message: string;
    nickname?: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) {
    return Response.json({ error: "メッセージが空です" }, { status: 400 });
  }

  // Fetch products that are available and in stock
  const products = await db.product.findMany({
    where: { isAvailable: true, stock: { gt: 0 } },
    orderBy: { category: "asc" },
  });

  // Fetch user order history
  let pastProducts: string[] = [];
  if (nickname) {
    const orders = await db.order.findMany({
      where: { nickname },
      include: { items: { include: { product: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    pastProducts = orders.flatMap((o) => o.items.map((i) => i.product.name));
  }

  const CATEGORY_JA: Record<string, string> = { bread: "パン", drink: "ドリンク", goods: "グッズ" };

  const productList = products
    .map((p) => `・${p.name}（${CATEGORY_JA[p.category] ?? p.category}）¥${p.price} ${p.description}`)
    .join("\n");

  const historyText =
    pastProducts.length > 0
      ? `これまでに注文したことがある商品：${[...new Set(pastProducts)].join("、")}`
      : "注文履歴なし";

  const systemPrompt = `あなたは学内ベーカリーの親切なおすすめアシスタント「ベーカリーくん」です。
ユーザーの好みや過去の注文履歴をもとに、現在販売中の商品をおすすめします。

【現在販売中の商品（在庫あり）】
${productList}

【${nickname ? `${nickname}さん` : "このお客様"}の情報】
${historyText}

【返答ルール】
- 上記の「現在販売中の商品」の中からのみすすめてください
- 2〜3品を具体的に紹介してください（商品名・価格・おすすめポイント）
- ユーザーの好みのキーワード（「甘い」「さっぱり」「お腹いっぱい」「珍しい」など）に合わせて選んでください
- 過去の注文履歴があれば、それも参考にしてください
- フレンドリーで親しみやすい日本語で話してください
- 返答は200字以内でコンパクトにまとめてください
- 商品名は「」で囲んでください`;

  const openai = new OpenAI({ apiKey });

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      // Keep last 6 messages to avoid token bloat
      ...history.slice(-6),
      { role: "user", content: message },
    ],
    stream: true,
    max_tokens: 300,
    temperature: 0.75,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
