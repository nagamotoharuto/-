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
  /** 棚に写っているパンの合計。種類別より信頼できるので、これを基準に配分する。 */
  totalCount: number;
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
 * 棚に写っているパンの総数を数える。
 *
 * このモデルは「何個写っているか」は素直に答えられる一方、種類の判別は
 * 苦手で数字が大きくぶれる。確かな方を先に押さえ、種類別の配分に使う。
 */
async function countTotal(shelfImageBase64: string): Promise<number> {
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
        {
          role: "system",
          content:
            "陳列棚の写真に写っているパンの個数を数えるアシスタントです。JSON以外出力しないでください。",
        },
        {
          role: "user",
          content:
            'この写真に写っているパンは全部で何個ですか。袋入りのものも1個として数えてください。{"count": 個数} の形式で答えてください。',
          images: [shelfImageBase64],
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
 * 種類別の見え方を、合計に合わせて配分し直す。
 *
 * 種類別の数字はぶれるが、どれが多くてどれが少ないかの傾向は拾える。
 * その比率だけを使い、個数は信頼できる合計に合わせる。端数は大きい順に
 * 配って、合計と必ず一致させる。
 */
function allocateToTotal(raw: number[], total: number): number[] {
  const sum = raw.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return raw.map(() => 0);

  const exact = raw.map((v) => (v / sum) * total);
  const floors = exact.map((v) => Math.floor(v));
  let remaining = total - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (const { i } of order) {
    if (remaining <= 0) break;
    result[i] += 1;
    remaining -= 1;
  }
  return result;
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
    const result: ShelfCountResult = {
      items: [],
      totalCount: 0,
      updatedAt: now,
      error: "ライブカメラが未設定です",
    };
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
      const result: ShelfCountResult = { items: [], totalCount: 0, updatedAt: now, error: null };
      cached = result;
      cachedAt = Date.now();
      return result;
    }

    // 見本写真の読み込みと棚の撮影は互いに待つ必要がないので同時に進める
    const [imageBase64, references] = await Promise.all([
      fetchImageAsBase64(cameraUrl),
      Promise.all(breadProducts.map((p) => loadReferenceImage(p.imageUrl))),
    ]);

    // まず棚全体の個数。ここがいちばん確かなので、種類別の基準にする。
    const totalCount = await countTotal(imageBase64);

    // 次に種類ごとの見え方。Ollamaは1つずつ処理するので順に聞く。
    const raw: number[] = [];
    for (let i = 0; i < breadProducts.length; i++) {
      raw.push(await countOne(imageBase64, breadProducts[i].name, references[i]));
    }

    // 種類別の数字は当てにならないので、比率だけ使って合計に合わせる
    const allocated = allocateToTotal(raw, totalCount);

    const items: ShelfCountItem[] = breadProducts.map((p, i) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      count: allocated[i],
    }));

    const result: ShelfCountResult = { items, totalCount, updatedAt: now, error: null };
    cached = result;
    cachedAt = Date.now();
    return result;
  } catch (err) {
    console.error("[shelfCount] refresh failed:", err);
    const message = err instanceof Error ? err.message : "カウントに失敗しました";
    // 一時的な失敗で表示が消えないよう、直前の結果を残す
    const result: ShelfCountResult = {
      items: cached?.items ?? [],
      totalCount: cached?.totalCount ?? 0,
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
