import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMetrics } from "@/lib/metrics";
import { toJstDateString } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Excel は UTF-8 の CSV を BOM なしだと文字化けさせるため先頭に付ける
const BOM = "﻿";

function toCsv(rows: (string | number | null)[][]): string {
  return (
    BOM +
    rows
      .map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return "";
            const text = String(cell);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          })
          .join(",")
      )
      .join("\r\n")
  );
}

function jstDateTime(value: Date | string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "daily";
    const today = toJstDateString();
    const from = searchParams.get("from") ?? today;
    const to = searchParams.get("to") ?? today;

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ error: "from / to は YYYY-MM-DD で指定してください" }, { status: 400 });
    }

    let rows: (string | number | null)[][];
    let filename: string;

    if (type === "orders") {
      const orders = await db.order.findMany({
        where: { pickupDate: { gte: from, lte: to } },
        include: { items: true },
        orderBy: [{ pickupDate: "asc" }, { createdAt: "asc" }],
      });

      rows = [
        [
          "予約番号", "受け取り日", "受け取り時刻", "予約日時", "氏名", "区分",
          "支払い方法", "ステータス", "解放日時", "合計金額",
          "商品名", "カテゴリ", "数量", "単価",
        ],
      ];
      for (const order of orders) {
        for (const item of order.items) {
          rows.push([
            order.orderNumber, order.pickupDate, order.pickupTime, jstDateTime(order.createdAt),
            order.nickname, order.userType, order.paymentMethod, order.status,
            jstDateTime(order.releasedAt), order.totalAmount,
            item.name, item.category, item.quantity, item.price,
          ]);
        }
      }
      filename = `orders_${from}_${to}.csv`;
    } else if (type === "walkin") {
      const sales = await db.walkInSale.findMany({
        where: { date: { gte: from, lte: to } },
        include: { product: { select: { name: true, category: true } } },
        orderBy: [{ date: "asc" }, { soldAt: "asc" }],
      });

      rows = [["販売日", "販売時刻", "商品名", "カテゴリ", "数量", "単価", "金額"]];
      for (const sale of sales) {
        rows.push([
          sale.date, jstDateTime(sale.soldAt), sale.product.name, sale.product.category,
          sale.quantity, sale.price, sale.price * sale.quantity,
        ]);
      }
      filename = `walkin_${from}_${to}.csv`;
    } else {
      // 既定：商品×販売日の指標（研究の主要な分析単位）
      const days = await getMetrics(from, to);
      rows = [
        [
          "販売日", "商品名", "カテゴリ", "発注数", "予約枠", "予約数", "満枠到達",
          "受け渡し数(予約)", "飛び込み販売数", "販売数合計",
          "予約売上", "飛び込み売上", "売上合計",
          "解放数", "記録上の残数", "閉店残数", "記録とのずれ", "売り切れ時刻",
          "日計:予約件数", "日計:受け渡し件数", "日計:無断不受け取り件数", "日計:無断不受け取り率",
          "日計:解放分の販売率", "日計:満枠到達商品数", "日計:売り切れ遭遇件数",
          "日計:予約売上", "日計:飛び込み売上", "日計:売上合計",
          "日計:予約販売数", "日計:飛び込み販売数", "日計:販売数合計",
        ],
      ];
      for (const day of days) {
        for (const item of day.items) {
          rows.push([
            day.date, item.productName, item.category, item.plannedQty, item.reservableQty,
            item.reservedQty, item.reachedCap ? 1 : 0,
            item.handedOverQty, item.walkInSoldQty, item.soldQty,
            item.reservedRevenue, item.walkInRevenue, item.reservedRevenue + item.walkInRevenue,
            item.releasedQty, item.remainingStock, item.closingQty, item.countDiff,
            jstDateTime(item.soldOutAt),
            day.reservationCount, day.completedCount, day.releasedCount,
            day.noShowRate === null ? "" : day.noShowRate.toFixed(4),
            day.releasedSellThroughRate === null ? "" : day.releasedSellThroughRate.toFixed(4),
            day.capReachedCount, day.turnawayCount,
            day.reservedRevenue, day.walkInRevenue, day.totalRevenue,
            day.reservedSoldQty, day.walkInSoldQty, day.totalSoldQty,
          ]);
        }
      }
      filename = `metrics_${from}_${to}.csv`;
    }

    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export error:", error);
    return NextResponse.json({ error: "書き出しに失敗しました" }, { status: 500 });
  }
}
