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
    } else if (type === "shelf") {
      const snapshots = await db.shelfSnapshot.findMany({
        where: { date: { gte: from, lte: to } },
        orderBy: [{ date: "asc" }, { recordedAt: "asc" }],
      });
      const products = await db.product.findMany({ select: { id: true, name: true } });
      const nameById = new Map(products.map((p) => [p.id, p.name]));

      rows = [["販売日", "記録日時", "商品名", "陳列数(AIカウント)"]];
      for (const snap of snapshots) {
        rows.push([
          snap.date, jstDateTime(snap.recordedAt),
          nameById.get(snap.productId) ?? snap.productId, snap.count,
        ]);
      }
      filename = `shelf_${from}_${to}.csv`;
    } else {
      // 既定：商品×販売日の指標（研究の主要な分析単位）
      const days = await getMetrics(from, to);
      rows = [
        [
          "販売日", "商品名", "カテゴリ", "発注数", "予約枠", "予約数", "満枠到達",
          "受け渡し数", "解放数", "閉店残数", "実売数", "飛び込み販売数", "売り切れ時刻",
          "その日の予約件数", "受け渡し件数", "無断不受け取り件数", "無断不受け取り率",
          "解放分の販売率", "満枠到達商品数", "売り切れ遭遇件数",
        ],
      ];
      for (const day of days) {
        for (const item of day.items) {
          rows.push([
            day.date, item.productName, item.category, item.plannedQty, item.reservableQty,
            item.reservedQty, item.reachedCap ? 1 : 0, item.handedOverQty, item.releasedQty,
            item.closingQty, item.soldQty, item.walkInSoldQty, jstDateTime(item.soldOutAt),
            day.reservationCount, day.completedCount, day.releasedCount,
            day.noShowRate === null ? "" : day.noShowRate.toFixed(4),
            day.releasedSellThroughRate === null ? "" : day.releasedSellThroughRate.toFixed(4),
            day.capReachedCount, day.turnawayCount,
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
