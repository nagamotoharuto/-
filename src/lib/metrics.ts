import { db } from "@/lib/db";
import { getReservableQty } from "@/lib/utils";
import { SLOT_HOLDING_STATUSES } from "@/lib/availability";

/**
 * 運用試験で収集する指標の集計。
 *
 * 研究目的(2)「予約の副作用を予約枠の制限と未受取分の解放で抑えられるか」を
 * 測るための数値をここに集約する。
 */

export interface ProductDayMetrics {
  date: string;
  productId: string;
  productName: string;
  category: string;
  /** 発注数 */
  plannedQty: number;
  /** 予約枠（発注数の70%） */
  reservableQty: number;
  /** 予約された数（キャンセル・解放を除く） */
  reservedQty: number;
  /** 予約枠が満枠になったか */
  reachedCap: boolean;
  /** 受け渡し済みの数（予約） */
  handedOverQty: number;
  /** 飛び込み客に売れた数 */
  walkInSoldQty: number;
  /** 予約の売上金（受け渡し済みのみ） */
  reservedRevenue: number;
  /** 飛び込み客の売上金 */
  walkInRevenue: number;
  /** 未受取で解放された数 */
  releasedQty: number;
  /** 記録上の販売数 = 受け渡し済み + 飛び込み */
  soldQty: number;
  /** 店頭の残数 = 発注数 − 販売数 */
  remainingStock: number;
  /** 閉店時の残数（未入力なら null） */
  closingQty: number | null;
  /** 記録と実際のずれ = 閉店残数 − 記録上の残数（残数未入力なら null） */
  countDiff: number | null;
  /** 店頭在庫が0になった時刻 */
  soldOutAt: string | null;
}

export interface DayMetrics {
  date: string;
  /** その日の予約件数（キャンセル除く） */
  reservationCount: number;
  /** 売上金 */
  reservedRevenue: number;
  walkInRevenue: number;
  totalRevenue: number;
  /** 販売個数 */
  reservedSoldQty: number;
  walkInSoldQty: number;
  totalSoldQty: number;
  /** 発注数の合計と、記録上の残数 */
  plannedQty: number;
  remainingStock: number;
  /** 閉店残数の合計（全商品そろっていなければ null） */
  closingQty: number | null;
  /** 受け渡し済みの予約件数 */
  completedCount: number;
  /** 無断不受け取り（解放）件数 */
  releasedCount: number;
  /** 無断不受け取り率 = 解放件数 / (受け渡し済み + 解放件数) */
  noShowRate: number | null;
  /** 解放された個数 */
  releasedQty: number;
  /**
   * 解放分の販売率。解放して棚に戻した個数のうち、閉店までに売れた割合。
   * 閉店残数が全商品分そろっている日だけ算出できる。
   */
  releasedSellThroughRate: number | null;
  /** 予約上限（満枠）到達回数：商品×日の単位で数える */
  capReachedCount: number;
  /** 飛び込み客が売り切れで買えなかった件数（販売員の手入力） */
  turnawayCount: number;
  /** その日いちばん早い売り切れ時刻 */
  firstSoldOutAt: string | null;
  items: ProductDayMetrics[];
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** 期間内の販売日ごとの指標。date は "YYYY-MM-DD"、from/to は両端を含む。 */
export async function getMetrics(from: string, to: string): Promise<DayMetrics[]> {
  const [dailyStocks, orders, turnaways, walkInSales] = await Promise.all([
    db.dailyStock.findMany({
      where: { date: { gte: from, lte: to } },
      include: { product: true },
      orderBy: [{ date: "asc" }],
    }),
    db.order.findMany({
      where: { pickupDate: { gte: from, lte: to } },
      include: { items: true },
    }),
    db.soldOutTurnaway.findMany({ where: { date: { gte: from, lte: to } } }),
    db.walkInSale.findMany({ where: { date: { gte: from, lte: to } } }),
  ]);

  const dates = new Set<string>([
    ...dailyStocks.map((d) => d.date),
    ...orders.map((o) => o.pickupDate),
    ...turnaways.map((t) => t.date),
    ...walkInSales.map((w) => w.date),
  ]);

  const result: DayMetrics[] = [];

  for (const date of Array.from(dates).filter(Boolean).sort()) {
    const dayStocks = dailyStocks.filter((d) => d.date === date);
    const dayOrders = orders.filter((o) => o.pickupDate === date);
    const dayTurnaways = turnaways.filter((t) => t.date === date);
    const daySales = walkInSales.filter((w) => w.date === date);

    // 予約枠を消費している注文（キャンセル・解放を除く）
    const holding = dayOrders.filter((o) =>
      (SLOT_HOLDING_STATUSES as readonly string[]).includes(o.status)
    );
    const completed = dayOrders.filter((o) => o.status === "completed");
    const released = dayOrders.filter((o) => o.status === "released");

    const qtyByProduct = (list: typeof dayOrders) => {
      const map = new Map<string, number>();
      for (const order of list) {
        for (const item of order.items) {
          map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
        }
      }
      return map;
    };

    const reservedMap = qtyByProduct(holding);
    const handedMap = qtyByProduct(completed);
    const releasedMap = qtyByProduct(released);

    // 予約の売上は受け渡しが済んだ分だけ。単価は注文時のものを使う。
    const reservedRevenueMap = new Map<string, number>();
    for (const order of completed) {
      for (const item of order.items) {
        reservedRevenueMap.set(
          item.productId,
          (reservedRevenueMap.get(item.productId) ?? 0) + item.price * item.quantity
        );
      }
    }

    const walkInQtyMap = new Map<string, number>();
    const walkInRevenueMap = new Map<string, number>();
    for (const sale of daySales) {
      walkInQtyMap.set(sale.productId, (walkInQtyMap.get(sale.productId) ?? 0) + sale.quantity);
      walkInRevenueMap.set(
        sale.productId,
        (walkInRevenueMap.get(sale.productId) ?? 0) + sale.price * sale.quantity
      );
    }

    const items: ProductDayMetrics[] = dayStocks.map((stock) => {
      const reservableQty = getReservableQty(stock.plannedQty, stock.product);
      const reservedQty = reservedMap.get(stock.productId) ?? 0;
      const handedOverQty = handedMap.get(stock.productId) ?? 0;
      const releasedQty = releasedMap.get(stock.productId) ?? 0;
      const walkInSoldQty = walkInQtyMap.get(stock.productId) ?? 0;
      const soldQty = handedOverQty + walkInSoldQty;
      const remainingStock = Math.max(0, stock.plannedQty - soldQty);

      return {
        date,
        productId: stock.productId,
        productName: stock.product.name,
        category: stock.product.category,
        plannedQty: stock.plannedQty,
        reservableQty,
        reservedQty,
        // 満枠は、予約枠が1個以上ある商品で予約済みが枠に達した状態
        reachedCap: reservableQty > 0 && reservedQty >= reservableQty,
        handedOverQty,
        walkInSoldQty,
        reservedRevenue: reservedRevenueMap.get(stock.productId) ?? 0,
        walkInRevenue: walkInRevenueMap.get(stock.productId) ?? 0,
        releasedQty,
        soldQty,
        remainingStock,
        closingQty: stock.closingQty,
        // 閉店時に数えた残数と記録上の残数の差。押し忘れや数え間違いの目安になる。
        countDiff: stock.closingQty === null ? null : stock.closingQty - remainingStock,
        soldOutAt: toIso(stock.soldOutAt),
      };
    });

    const sum = (pick: (i: ProductDayMetrics) => number) =>
      items.reduce((acc, i) => acc + pick(i), 0);

    const releasedQtyTotal = sum((i) => i.releasedQty);
    const reservedRevenue = sum((i) => i.reservedRevenue);
    const walkInRevenue = sum((i) => i.walkInRevenue);
    const reservedSoldQty = sum((i) => i.handedOverQty);
    const walkInSoldQty = sum((i) => i.walkInSoldQty);

    // 解放した個数のうち何個が閉店までに売れたか。
    // 棚に戻した分と売れ残りの差から求めるので、残数が全商品そろった日だけ。
    const closingComplete = items.length > 0 && items.every((i) => i.closingQty !== null);
    let releasedSellThroughRate: number | null = null;
    if (closingComplete && releasedQtyTotal > 0) {
      const releasedSold = items.reduce(
        (acc, i) => acc + Math.max(0, i.releasedQty - (i.closingQty ?? 0)),
        0
      );
      releasedSellThroughRate = releasedSold / releasedQtyTotal;
    }

    const soldOutTimes = items
      .map((i) => i.soldOutAt)
      .filter((v): v is string => v !== null)
      .sort();

    const decided = completed.length + released.length;

    result.push({
      date,
      reservationCount: dayOrders.filter((o) => o.status !== "cancelled").length,
      completedCount: completed.length,
      releasedCount: released.length,
      // 受け取りの成否が確定した予約だけを母数にする（まだ待っている予約は除く）
      noShowRate: decided > 0 ? released.length / decided : null,
      releasedQty: releasedQtyTotal,
      releasedSellThroughRate,
      capReachedCount: items.filter((i) => i.reachedCap).length,
      turnawayCount: dayTurnaways.length,
      firstSoldOutAt: soldOutTimes[0] ?? null,
      reservedRevenue,
      walkInRevenue,
      totalRevenue: reservedRevenue + walkInRevenue,
      reservedSoldQty,
      walkInSoldQty,
      totalSoldQty: reservedSoldQty + walkInSoldQty,
      plannedQty: sum((i) => i.plannedQty),
      remainingStock: sum((i) => i.remainingStock),
      closingQty: closingComplete ? sum((i) => i.closingQty ?? 0) : null,
      items,
    });
  }

  return result;
}
