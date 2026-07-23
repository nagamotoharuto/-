import { db } from "@/lib/db";

// Runs locally on this machine via Ollama (http://localhost:11434) — no per-call
// cost and no dependency on OpenAI's API quota, at the cost of some accuracy
// versus a larger cloud model.
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:7b";

export interface ShelfCountItem {
  id: string;
  name: string;
  imageUrl: string;
  count: number;
}

export interface ShelfCountResult {
  items: ShelfCountItem[];
  updatedAt: string;
  error: string | null;
}

// Shared across all viewers of the live camera page: at most one OpenAI
// vision call runs per CACHE_TTL_MS window, no matter how many people (or
// how many polls from the same page) ask for the count at once.
const CACHE_TTL_MS = 30_000;

let cached: ShelfCountResult | null = null;
let cachedAt = 0;
let inFlight: Promise<ShelfCountResult> | null = null;

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`カメラ画像の取得に失敗しました (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.toString("base64");
}

async function countBreadInImage(
  imageBase64: string,
  candidates: { name: string }[]
): Promise<Record<string, number>> {
  const names = candidates.map((c) => c.name);

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0 },
      messages: [
        {
          role: "system",
          content:
            "あなたはパン屋の陳列棚を撮影した写真から、指定された種類ごとにパンの個数を数える画像認識アシスタントです。写真に実際に写っている数だけを数えてください。指定された種類の中に写真に写っていないものがあれば0にしてください。JSON以外の文章は出力しないでください。",
        },
        {
          role: "user",
          content:
            `次のパン全ての種類について、写真に写っている個数を数えてください: ${names.join("、")}\n\n` +
            `必ず次のJSON形式のみで回答してください。キーは上記の名前を一字一句そのまま使い、全種類を必ず含めてください:\n` +
            `{"counts": {${names.map((n) => `"${n}": 個数`).join(", ")}}}`,
          images: [imageBase64],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`ローカルAI(Ollama)の呼び出しに失敗しました (HTTP ${res.status})`);

  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { counts?: Record<string, number> };
  return parsed.counts ?? {};
}

async function refresh(): Promise<ShelfCountResult> {
  const cameraUrl = process.env.NEXT_PUBLIC_CAMERA_STREAM_URL;
  const now = new Date().toISOString();

  if (!cameraUrl) {
    const result: ShelfCountResult = { items: [], updatedAt: now, error: "ライブカメラが未設定です" };
    cached = result;
    cachedAt = Date.now();
    return result;
  }

  try {
    const breadProducts = await db.product.findMany({
      where: { category: "bread" },
      select: { id: true, name: true, imageUrl: true },
      orderBy: { createdAt: "asc" },
    });

    if (breadProducts.length === 0) {
      const result: ShelfCountResult = { items: [], updatedAt: now, error: null };
      cached = result;
      cachedAt = Date.now();
      return result;
    }

    const imageBase64 = await fetchImageAsBase64(cameraUrl);
    const counts = await countBreadInImage(imageBase64, breadProducts);

    const items: ShelfCountItem[] = breadProducts.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      count: Math.max(0, Math.min(99, Math.round(Number(counts[p.name]) || 0))),
    }));

    // Per the chosen design: the AI count directly becomes the sellable stock.
    await Promise.all(
      items.map((item) => db.product.update({ where: { id: item.id }, data: { stock: item.count } }))
    );

    const result: ShelfCountResult = { items, updatedAt: now, error: null };
    cached = result;
    cachedAt = Date.now();
    return result;
  } catch (err) {
    console.error("[shelfCount] refresh failed:", err);
    const message = err instanceof Error ? err.message : "カウントに失敗しました";
    // Keep whatever was last known good so the UI doesn't blank out on a transient failure.
    const result: ShelfCountResult = {
      items: cached?.items ?? [],
      updatedAt: cached?.updatedAt ?? now,
      error: message,
    };
    cached = result;
    cachedAt = Date.now();
    return result;
  }
}

export async function getShelfCount(): Promise<ShelfCountResult> {
  const isFresh = cached !== null && Date.now() - cachedAt < CACHE_TTL_MS;
  if (isFresh) return cached!;
  if (inFlight) return inFlight;

  inFlight = refresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
