import { db } from "@/lib/db";

// 画像認識はこのMacのOllama(http://localhost:11434)で動く。呼び出しに費用が
// かからず、外部サービスの状態にも左右されない代わりに、Ollamaが動いている
// 端末からしか使えない。
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

// ライブカメラ画面を何人が開いていても、この間隔に1回しか認識を走らせない。
// 画像認識は数秒かかるので、ポーリングのたびに呼ぶと詰まる。
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

/**
 * カメラの写真からパンの個数を数える。
 *
 * これは「棚を見た印象」を伝えるための表示専用で、数えた結果はどこにも
 * 保存しない。残数も売り切れ時刻も、販売員が押すボタンの記録から決まる。
 * AIの推定で販売記録が動かないようにしている。
 */
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
    // 数えるのはパンだけ。お菓子も food だが棚のカウント対象には含めない。
    const breadProducts = await db.product.findMany({
      where: { subCategory: "bread", isAvailable: true },
      select: { id: true, name: true, imageUrl: true },
      orderBy: { name: "asc" },
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

    const result: ShelfCountResult = { items, updatedAt: now, error: null };
    cached = result;
    cachedAt = Date.now();
    return result;
  } catch (err) {
    console.error("[shelfCount] refresh failed:", err);
    const message = err instanceof Error ? err.message : "カウントに失敗しました";
    // 一時的な失敗で表示が消えないよう、直前の結果を残す
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
