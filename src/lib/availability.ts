import { db } from "@/lib/db";
import {
  compareProducts,
  getReleaseDeadline,
  getReservableQty,
  getWalkInSharePercent,
  toJstDateString,
} from "@/lib/utils";

// Statuses that still hold a reservation slot. "cancelled" and "released"
// hand the item back to the shelf, so they free their slot again.
export const SLOT_HOLDING_STATUSES = ["pending", "ready", "completed"] as const;

// 受け取り前の予約。棚には残っているが、飛び込み客に売ってはいけない分。
const AWAITING_PICKUP_STATUSES = ["pending", "ready"] as const;

// Statuses a reservation can still be released from — it has neither been
// collected nor already given up.
const RELEASABLE_STATUSES = ["pending", "ready"] as const;

export interface ProductAvailability {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  price: number;
  imageUrl: string;
  description: string;
  isAvailable: boolean;
  /** その日の品揃えに入っているか（発注数が1個以上） */
  isOffered: boolean;
  /** 発注数 */
  plannedQty: number;
  /** 予約枠: 発注数のうち予約に回せる上限 */
  reservableQty: number;
  /** 店頭に確保される割合（%）。お菓子は0で、全量が予約枠になる。 */
  walkInSharePercent: number;
  /** 予約が入っている数（キャンセル・解放を除く） */
  reservedQty: number;
  /** まだ受け取られていない予約数 */
  unfulfilledQty: number;
  /** 受け渡し済みの予約数 */
  handedOverQty: number;
  /** 飛び込み客に売れた数 */
  walkInSoldQty: number;
  /** 店頭の残数 = 発注数 − 飛び込み販売 − 受け渡し済み */
  remainingStock: number;
  /** 予約可能残数 */
  remainingQty: number;
  /** 閉店時の残数（未入力なら null） */
  closingQty: number | null;
}

/**
 * Releases reservations that are past their pickup time by the grace period
 * and were never collected, returning their slots to walk-up sale.
 *
 * Idempotent, so it is safe to call from anywhere. The staff dashboard polls
 * it, and placing an order runs it first so freed slots are immediately
 * bookable even while no staff screen is open.
 */
export async function releaseOverdueReservations(now: Date = new Date()): Promise<number> {
  const candidates = await db.order.findMany({
    where: { status: { in: [...RELEASABLE_STATUSES] } },
    select: { id: true, pickupDate: true, pickupTime: true },
  });

  const overdueIds = candidates
    .filter((o) => o.pickupDate && getReleaseDeadline(o.pickupDate, o.pickupTime) <= now)
    .map((o) => o.id);

  if (overdueIds.length === 0) return 0;

  const result = await db.order.updateMany({
    where: { id: { in: overdueIds }, status: { in: [...RELEASABLE_STATUSES] } },
    data: { status: "released", releasedAt: now },
  });
  return result.count;
}

/** 毎日ほぼ同じ品揃えで、前日の発注数をそのまま引き継ぐ売り場かどうか。 */
function carriesOver(p: { category: string; subCategory: string }): boolean {
  return p.category === "drink" || p.subCategory === "sweets";
}

// 遡って探す上限。これより前の発注数は参考にしない。
const CARRY_OVER_LOOKBACK_DAYS = 60;

/**
 * ドリンクとお菓子の発注数を前回から引き継ぐ。
 *
 * この2つはほぼ毎日同じ数を出すため、販売日ごとに入力させると手間が
 * かかるだけになる。まだ決めていない日は、直近で入れた数をそのまま置く。
 *
 * 行を実際に作るのは、閉店処理や売上集計が DailyStock の行を前提に
 * しているため。過去の日付は履歴なので触らない。
 */
export async function ensureCarryOver(date: string): Promise<number> {
  if (date < toJstDateString()) return 0;

  const products = await db.product.findMany({
    where: { OR: [{ category: "drink" }, { subCategory: "sweets" }] },
    select: { id: true },
  });
  if (products.length === 0) return 0;

  const ids = products.map((p) => p.id);
  const existing = await db.dailyStock.findMany({
    where: { date, productId: { in: ids } },
    select: { productId: true },
  });
  const done = new Set(existing.map((e) => e.productId));
  const missing = ids.filter((id) => !done.has(id));
  if (missing.length === 0) return 0;

  const since = toJstDateString(
    new Date(new Date(`${date}T00:00:00+09:00`).getTime() - CARRY_OVER_LOOKBACK_DAYS * 86400_000)
  );
  const past = await db.dailyStock.findMany({
    where: { productId: { in: missing }, date: { gte: since, lt: date }, plannedQty: { gt: 0 } },
    orderBy: { date: "desc" },
    select: { productId: true, plannedQty: true },
  });

  // 同じ商品が複数日ぶん返るので、いちばん新しい日の数だけ採る
  const latest = new Map<string, number>();
  for (const row of past) {
    if (!latest.has(row.productId)) latest.set(row.productId, row.plannedQty);
  }
  if (latest.size === 0) return 0;

  const result = await db.dailyStock.createMany({
    data: [...latest].map(([productId, plannedQty]) => ({ productId, date, plannedQty })),
    skipDuplicates: true,
  });
  return result.count;
}

/** 販売日の注文明細を、状態ごとに商品単位で数える。 */
async function getOrderQuantities(date: string) {
  const items = await db.orderItem.findMany({
    where: { order: { pickupDate: date } },
    select: { productId: true, quantity: true, order: { select: { status: true } } },
  });

  const reserved = new Map<string, number>();
  const awaiting = new Map<string, number>();
  const handedOver = new Map<string, number>();

  const add = (map: Map<string, number>, id: string, qty: number) =>
    map.set(id, (map.get(id) ?? 0) + qty);

  for (const item of items) {
    const status = item.order.status;
    if ((SLOT_HOLDING_STATUSES as readonly string[]).includes(status)) {
      add(reserved, item.productId, item.quantity);
    }
    if ((AWAITING_PICKUP_STATUSES as readonly string[]).includes(status)) {
      add(awaiting, item.productId, item.quantity);
    }
    if (status === "completed") {
      add(handedOver, item.productId, item.quantity);
    }
  }

  return { reserved, awaiting, handedOver };
}

/** 販売日の飛び込み販売を商品単位で数える。 */
export async function getWalkInQuantities(date: string): Promise<Map<string, number>> {
  const sales = await db.walkInSale.findMany({
    where: { date },
    select: { productId: true, quantity: true },
  });

  const sold = new Map<string, number>();
  for (const sale of sales) {
    sold.set(sale.productId, (sold.get(sale.productId) ?? 0) + sale.quantity);
  }
  return sold;
}

/**
 * Reservation availability for every product on a given sale date.
 *
 * 予約可能数は2つの上限の小さい方。発注数から決まる予約枠と、棚に実際に
 * 残っている数のうち受け取り前の予約に取られていない分。飛び込み客に売れて
 * 棚が薄くなれば、枠が余っていても予約は受けられなくなる。
 */
export async function getAvailability(date: string): Promise<ProductAvailability[]> {
  const [products, dailyStocks, orderQty, walkInSold] = await Promise.all([
    db.product.findMany(),
    db.dailyStock.findMany({ where: { date } }),
    getOrderQuantities(date),
    getWalkInQuantities(date),
  ]);

  const stockByProduct = new Map(dailyStocks.map((d) => [d.productId, d]));

  return [...products].sort(compareProducts).map((p) => {
    const daily = stockByProduct.get(p.id);
    const plannedQty = daily?.plannedQty ?? 0;
    const reservableQty = getReservableQty(plannedQty, p);

    const reservedQty = orderQty.reserved.get(p.id) ?? 0;
    const unfulfilledQty = orderQty.awaiting.get(p.id) ?? 0;
    const handedOverQty = orderQty.handedOver.get(p.id) ?? 0;
    const walkInSoldQty = walkInSold.get(p.id) ?? 0;

    const remainingStock = Math.max(0, plannedQty - walkInSoldQty - handedOverQty);

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      subCategory: p.subCategory,
      price: p.price,
      imageUrl: p.imageUrl,
      description: p.description,
      isAvailable: p.isAvailable,
      isOffered: plannedQty > 0,
      plannedQty,
      reservableQty,
      walkInSharePercent: getWalkInSharePercent(p),
      reservedQty,
      unfulfilledQty,
      handedOverQty,
      walkInSoldQty,
      remainingStock,
      remainingQty: Math.max(
        0,
        Math.min(reservableQty - reservedQty, remainingStock - unfulfilledQty)
      ),
      closingQty: daily?.closingQty ?? null,
    };
  });
}

/**
 * 店頭の残数が0になった時点を売り切れ時刻として記録する。
 * 数え間違いで在庫が戻ったときは消して、次に0になった時刻を採る。
 */
export async function syncSoldOutAt(date: string, productId: string): Promise<void> {
  const [daily, orderQty, walkInSold] = await Promise.all([
    db.dailyStock.findUnique({ where: { productId_date: { productId, date } } }),
    getOrderQuantities(date),
    getWalkInQuantities(date),
  ]);
  if (!daily) return;

  const remaining =
    daily.plannedQty -
    (walkInSold.get(productId) ?? 0) -
    (orderQty.handedOver.get(productId) ?? 0);

  if (remaining <= 0 && !daily.soldOutAt) {
    await db.dailyStock.update({ where: { id: daily.id }, data: { soldOutAt: new Date() } });
  } else if (remaining > 0 && daily.soldOutAt) {
    await db.dailyStock.update({ where: { id: daily.id }, data: { soldOutAt: null } });
  }
}
