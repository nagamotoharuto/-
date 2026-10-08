import sharp from "sharp";
import { db } from "@/lib/db";
import { toJstDateString } from "@/lib/utils";

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
const CACHE_TTL_MS = 60_000;

// 見本写真はどれがどのパンか分かれば足りるので、小さく圧縮して渡す。
// 枚数が増えるぶん、1枚あたりを軽くしないと認識が遅くなる。
const REFERENCE_WIDTH = 256;

let cached: ShelfCountResult | null = null;
let cachedAt = 0;
let inFlight: Promise<ShelfCountResult> | null = null;

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`カメラ画像の取得に失敗しました (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.toString("base64");
}

/**
 * 商品登録の写真を見本として読み込む。
 *
 * 商品名だけを頼りに数えさせると、名前から見た目が想像しにくいパンや
 * 外見の似たパンを取り違える。実物の写真を先に見せてから棚を数えさせる。
 * 写真が未登録の商品は見本なしで名前だけを頼ることになる。
 */
async function loadReferenceImage(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    // DBに置いた写真は /api/images/<id> で配信しているので、内部から直接引く
    const match = imageUrl.match(/^\/api\/images\/([0-9a-z]+)$/i);
    let raw: Buffer;

    if (match) {
      const image = await db.productImage.findUnique({
        where: { id: match[1] },
        select: { data: true },
      });
      if (!image) return null;
      raw = Buffer.from(image.data);
    } else {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      raw = Buffer.from(await res.arrayBuffer());
    }

    const resized = await sharp(raw)
      .resize({ width: REFERENCE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return resized.toString("base64");
  } catch (err) {
    console.error("[shelfCount] reference image failed:", err);
    return null;
  }
}

/**
 * 1種類ずつ「見本写真」と「棚の写真」の2枚だけを見せて数えさせる。
 *
 * 見本をまとめて渡すと、このモデルは照合をやめて 0,1,2,3… と連番を
 * 返すようになる（3枚以上で再現）。2枚に絞れば素直に数えるため、
 * 種類の数だけ呼び出しを分けている。
 */
async function countOne(
  shelfImageBase64: string,
  name: string,
  reference: string | null
): Promise<number> {
  const images = reference ? [reference, shelfImageBase64] : [shelfImageBase64];

  const system = reference
    ? "1枚目は商品の見本写真、2枚目は陳列棚の写真です。棚の写真の中に、見本と同じ商品が何個写っているかだけを数えてください。見本と違うものは数えないでください。JSON以外出力しないでください。"
    : "陳列棚の写真から、指定された商品が何個写っているかだけを数えてください。写っていなければ0にしてください。JSON以外出力しないでください。";

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0 },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            `${reference ? `見本は「${name}」です。` : ""}` +
            `棚の写真に「${name}」が何個写っていますか。{"count": 個数} の形式で答えてください。`,
          images,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`ローカルAI(Ollama)の呼び出しに失敗しました (HTTP ${res.status})`);

  const data = (await res.json()) as { message?: { content?: string } };
  const parsed = JSON.parse(data.message?.content ?? "{}") as { count?: number };
  return Math.max(0, Math.min(99, Math.round(Number(parsed.count) || 0)));
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
    // 数えるのは「その日に売るパン」だけ。
    // 全商品を対象にすると見本写真の枚数が増えすぎ、モデルが取り違えて
    // でたらめな数を返すようになる。棚に並ぶ可能性があるものに絞る。
    const todayStocks = await db.dailyStock.findMany({
      where: { date: toJstDateString(), plannedQty: { gt: 0 } },
      include: { product: true },
    });

    const breadProducts = todayStocks
      .map((d) => d.product)
      .filter((p) => p.subCategory === "bread" && p.isAvailable)
      .sort((a, b) => a.name.localeCompare(b.name, "ja"))
      .map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl }));

    if (breadProducts.length === 0) {
      const result: ShelfCountResult = { items: [], updatedAt: now, error: null };
      cached = result;
      cachedAt = Date.now();
      return result;
    }

    // 見本写真の読み込みと棚の撮影は互いに待つ必要がないので同時に進める
    const [imageBase64, references] = await Promise.all([
      fetchImageAsBase64(cameraUrl),
      Promise.all(breadProducts.map((p) => loadReferenceImage(p.imageUrl))),
    ]);

    // Ollamaは1つずつ処理するので、並べても速くならない。順に聞く。
    const items: ShelfCountItem[] = [];
    for (let i = 0; i < breadProducts.length; i++) {
      const p = breadProducts[i];
      items.push({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        count: await countOne(imageBase64, p.name, references[i]),
      });
    }

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
