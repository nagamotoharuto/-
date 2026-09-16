"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Download, AlertTriangle } from "lucide-react";
import StaffHeader from "@/components/features/StaffHeader";
import { cn, toJstDateString } from "@/lib/utils";

interface ProductDayMetrics {
  date: string;
  productName: string;
  plannedQty: number;
  reservableQty: number;
  reservedQty: number;
  reachedCap: boolean;
  handedOverQty: number;
  releasedQty: number;
  closingQty: number | null;
  soldQty: number | null;
  walkInSoldQty: number | null;
  soldOutAt: string | null;
}

interface DayMetrics {
  date: string;
  reservationCount: number;
  completedCount: number;
  releasedCount: number;
  noShowRate: number | null;
  releasedQty: number;
  releasedSellThroughRate: number | null;
  capReachedCount: number;
  turnawayCount: number;
  firstSoldOutAt: string | null;
  items: ProductDayMetrics[];
}

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function jstTime(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleTimeString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function daysAgo(n: number): string {
  return toJstDateString(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

/**
 * 研究の【運用試験】で収集する指標をまとめて確認・書き出しする画面。
 *
 * 無断不受け取り率・解放分の販売率・予約上限到達回数・飛び込み客の
 * 売り切れ遭遇率が、そのまま論文の分析単位になる。
 */
export default function ResearchPage() {
  const router = useRouter();
  const [from, setFrom] = useState(() => daysAgo(13));
  const [to, setTo] = useState(() => toJstDateString());
  const [days, setDays] = useState<DayMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setDays(Array.isArray(data.days) ? data.days : []);
        setError(data.error ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("集計の取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // 期間全体の集計。率は件数を足し合わせてから割る（日ごとの率の平均ではない）
  const totals = days.reduce(
    (acc, d) => {
      acc.completed += d.completedCount;
      acc.released += d.releasedCount;
      acc.releasedQty += d.releasedQty;
      acc.capReached += d.capReachedCount;
      acc.turnaway += d.turnawayCount;
      acc.reservations += d.reservationCount;
      return acc;
    },
    { completed: 0, released: 0, releasedQty: 0, capReached: 0, turnaway: 0, reservations: 0 }
  );
  const decided = totals.completed + totals.released;
  const noShowRate = decided > 0 ? totals.released / decided : null;

  const closingMissing = days.filter(
    (d) => d.items.length > 0 && d.items.some((i) => i.closingQty === null)
  );

  const exportUrl = (type: string) =>
    `/api/export?type=${type}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="font-black text-[#1a1a1a] text-lg flex items-center gap-2 mb-1">
          <FlaskConical size={18} className="text-[#8B1A2C]" />
          調査データ
        </h1>
        <p className="text-xs text-[#6b5e52] mb-4">
          運用試験で収集する指標です。期間を指定して確認・書き出しできます。
        </p>

        {/* Period */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-bold text-[#6b5e52] mb-1">開始日</label>
              <input
                type="date"
                value={from}
                onChange={(e) => e.target.value && setFrom(e.target.value)}
                className="border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b5e52] mb-1">終了日</label>
              <input
                type="date"
                value={to}
                onChange={(e) => e.target.value && setTo(e.target.value)}
                className="border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {/* Headline metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-[#e8e0d8] rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-[#8B1A2C]">{pct(noShowRate)}</p>
            <p className="text-xs text-[#6b5e52] leading-tight mt-1">無断不受け取り率</p>
            <p className="text-[10px] text-[#6b5e52]">
              {totals.released} / {decided} 件
            </p>
          </div>
          <div className="bg-white border border-[#e8e0d8] rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-[#8B1A2C]">{totals.capReached}</p>
            <p className="text-xs text-[#6b5e52] leading-tight mt-1">予約上限到達</p>
            <p className="text-[10px] text-[#6b5e52]">商品×日</p>
          </div>
          <div className="bg-white border border-[#e8e0d8] rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-[#8B1A2C]">{totals.turnaway}</p>
            <p className="text-xs text-[#6b5e52] leading-tight mt-1">売り切れ遭遇</p>
            <p className="text-[10px] text-[#6b5e52]">飛び込み客・手入力</p>
          </div>
          <div className="bg-white border border-[#e8e0d8] rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-[#8B1A2C]">{totals.releasedQty}</p>
            <p className="text-xs text-[#6b5e52] leading-tight mt-1">解放した個数</p>
            <p className="text-[10px] text-[#6b5e52]">店頭へ戻した分</p>
          </div>
        </div>

        {closingMissing.length > 0 && (
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl px-4 py-3 mb-4 text-xs">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              閉店残数が未入力の日が {closingMissing.length} 日あります（
              {closingMissing.map((d) => d.date).join("、")}）。
              入力がそろわないと、その日の実売数・飛び込み販売数・解放分の販売率が算出できません。
            </span>
          </div>
        )}

        {/* Export */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-4">
          <h2 className="text-sm font-bold text-[#1a1a1a] mb-2">CSV書き出し</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { type: "metrics", label: "指標（商品×販売日）" },
              { type: "orders", label: "予約明細" },
            ].map((item) => (
              <a
                key={item.type}
                href={exportUrl(item.type)}
                className="flex items-center gap-1.5 bg-[#8B1A2C] text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-[#A52235] transition-colors"
              >
                <Download size={13} />
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Per-day table */}
        {loading ? (
          <div className="bg-white rounded-2xl h-48 animate-pulse border border-[#e8e0d8]" />
        ) : days.length === 0 ? (
          <p className="text-center text-sm text-[#6b5e52] py-12">
            この期間のデータはまだありません
          </p>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f5f0eb] text-[#6b5e52] text-xs">
                    <th className="text-left font-bold px-3 py-2 whitespace-nowrap">販売日</th>
                    <th className="text-right font-bold px-3 py-2 whitespace-nowrap">予約</th>
                    <th className="text-right font-bold px-3 py-2 whitespace-nowrap">受渡</th>
                    <th className="text-right font-bold px-3 py-2 whitespace-nowrap">不受取</th>
                    <th className="text-right font-bold px-3 py-2 whitespace-nowrap">不受取率</th>
                    <th className="text-right font-bold px-3 py-2 whitespace-nowrap">解放販売率</th>
                    <th className="text-right font-bold px-3 py-2 whitespace-nowrap">満枠</th>
                    <th className="text-right font-bold px-3 py-2 whitespace-nowrap">売切遭遇</th>
                    <th className="text-right font-bold px-3 py-2 whitespace-nowrap">初回売切</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date} className="border-t border-[#e8e0d8]">
                      <td className="px-3 py-2 font-medium text-[#1a1a1a] whitespace-nowrap">
                        {day.date}
                      </td>
                      <td className="px-3 py-2 text-right">{day.reservationCount}</td>
                      <td className="px-3 py-2 text-right">{day.completedCount}</td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-bold",
                          day.releasedCount > 0 ? "text-orange-700" : "text-[#6b5e52]"
                        )}
                      >
                        {day.releasedCount}
                      </td>
                      <td className="px-3 py-2 text-right">{pct(day.noShowRate)}</td>
                      <td className="px-3 py-2 text-right">{pct(day.releasedSellThroughRate)}</td>
                      <td className="px-3 py-2 text-right">{day.capReachedCount}</td>
                      <td className="px-3 py-2 text-right">{day.turnawayCount}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {jstTime(day.firstSoldOutAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
