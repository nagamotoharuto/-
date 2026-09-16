import { db } from "@/lib/db";
import {
  compareProducts,
  getReleaseDeadline,
  getReservableQty,
  getWalkInSharePercent,
} from "@/lib/utils";

// Statuses that still hold a reservation slot. "cancelled" and "released"
// hand the item back to the shelf, so they free their slot again.
export const SLOT_HOLDING_STATUSES = ["pending", "ready", "completed"] as const;

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
  /** その日の品揃えに入っているか（発注数が1個以上）。0なら customers never see it. */
  isOffered: boolean;
  /** 発注数: how many are being produced for this sale date */
  plannedQty: number;
  /** 予約枠: the bookable share of plannedQty (the rest is held for walk-ups) */
  reservableQty: number;
  /** 店頭に確保される割合（%）。お菓子は0で、全量が予約枠になる。 */
  walkInSharePercent: number;
  /** already booked by other customers for this date */
  reservedQty: number;
  /** 予約可能残数 */
  remainingQty: number;
  /** 店頭在庫（販売員が管理。飛び込み販売のたびに減らす） */
  shelfQty: number | null;
  /** まだ受け渡していない予約数。店頭在庫がこれを下回ると予約分を売ってしまう */
  unfulfilledQty: number;
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

/** 受け渡し前の予約数。店頭で売ってしまうと足りなくなる分。 */
export async function getUnfulfilledQuantities(date: string): Promise<Map<string, number>> {
  const items = await db.orderItem.findMany({
    where: { order: { pickupDate: date, status: { in: ["pending", "ready"] } } },
    select: { productId: true, quantity: true },
  });

  const pending = new Map<string, number>();
  for (const item of items) {
    pending.set(item.productId, (pending.get(item.productId) ?? 0) + item.quantity);
  }
  return pending;
}

/** How many of each product are already reserved for a sale date, by product id. */
export async function getReservedQuantities(date: string): Promise<Map<string, number>> {
  const items = await db.orderItem.findMany({
    where: { order: { pickupDate: date, status: { in: [...SLOT_HOLDING_STATUSES] } } },
    select: { productId: true, quantity: true },
  });

  const reserved = new Map<string, number>();
  for (const item of items) {
    reserved.set(item.productId, (reserved.get(item.productId) ?? 0) + item.quantity);
  }
  return reserved;
}

/**
 * Reservation availability for every product on a given sale date.
 *
 * Falls back to the product's live shelf count when staff have not entered a
 * planned quantity for the date yet, so the menu still works on a day nobody
 * filled in the 発注 sheet.
 */
export async function getAvailability(date: string): Promise<ProductAvailability[]> {
  const [products, dailyStocks, reserved] = await Promise.all([
    db.product.findMany(),
    db.dailyStock.findMany({ where: { date } }),
    getReservedQuantities(date),
  ]);

  const stockByProduct = new Map(dailyStocks.map((d) => [d.productId, d]));
  const unfulfilled = await getUnfulfilledQuantities(date);

  return [...products].sort(compareProducts).map((p) => {
    const daily = stockByProduct.get(p.id);
    const plannedQty = daily?.plannedQty ?? p.stock;
    const reservableQty = getReservableQty(plannedQty, p);
    const reservedQty = reserved.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      subCategory: p.subCategory,
      price: p.price,
      imageUrl: p.imageUrl,
      description: p.description,
      isAvailable: p.isAvailable,
      // The bread line-up changes daily: a product with nothing produced for
      // this date is simply not on that day's menu.
      isOffered: plannedQty > 0,
      plannedQty,
      reservableQty,
      walkInSharePercent: getWalkInSharePercent(p),
      reservedQty,
      remainingQty: Math.max(0, reservableQty - reservedQty),
      shelfQty: daily?.shelfQty ?? null,
      unfulfilledQty: unfulfilled.get(p.id) ?? 0,
    };
  });
}
