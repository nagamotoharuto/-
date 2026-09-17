"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Download, DoorClosed, AlertTriangle } from "lucide-react";
import StaffHeader from "@/components/features/StaffHeader";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  cn,
  formatJstDateLabel,
  formatPrice,
  toJstDateString,
} from "@/lib/utils";

interface ProductDayMetrics {
  productId: string;
  productName: string;
  category: string;
  plannedQty: number;
  reservableQty: number;
  reservedQty: number;
  reachedCap: boolean;
  handedOverQty: number;
  walkInSoldQty: number;
  reservedRevenue: number;
  walkInRevenue: number;
  releasedQty: number;
  soldQty: number;
  remainingStock: number;
  closingQty: number | null;
  countDiff: number | null;
  soldOutAt: string | null;
}

interface DayMetrics {
  date: string;
  reservationCount: number;
  completedCount: number;
  releasedCount: number;
  noShowRate: number | null;
  releasedQty: number;
  capReachedCount: number;
  turnawayCount: number;
  firstSoldOutAt: string | null;
  reservedRevenue: number;
  walkInRevenue: number;
  totalRevenue: number;
  reservedSoldQty: number;
  walkInSoldQty: number;
  totalSoldQty: number;
  plannedQty: number;
  remainingStock: number;
  closingQty: number | null;
  items: ProductDayMetrics[];
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
 * 過去の販売日の記録。日付を選ぶとその日の数字と閉店残数が出る。
 * 入力した残数はそのまま保存され、日を切り替えても消えない。
 */
export default function RecordsPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => toJstDateString());
  const [day, setDay] = useState<DayMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // CSVは期間で出す
  const [from, setFrom] = useState(() => daysAgo(13));
  const [to, setTo] = useState(() => toJstDateString());

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/metrics?from=${date}&to=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setDay(data.days?.[0] ?? null);
        setDrafts({});
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("記録の読み込みに失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  function selectDate(next: string) {
    if (!next || next === date) return;
    setLoading(true);
    setDate(next);
  }

  const saveClosingQty = useCallback(
    async (productId: string, value: number, plannedQty: number, name: string) => {
      const safe = Math.max(0, value);
      if (safe > plannedQty) {
        setError(`「${name}」の残数が発注数(${plannedQty}個)を超えています`);
        return;
      }
      setError("");

      const res = await fetch("/api/daily-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, date, closingQty: safe }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
      } else {
        setSavedId(productId);
        setTimeout(() => setSavedId((c) => (c === productId ? null : c)), 1500);
      }
      setReloadKey((k) => k + 1);
    },
    [date]
  );

  const rows = (day?.items ?? []).filter((i) => i.plannedQty > 0);
  const entered = rows.filter((r) => r.closingQty !== null).length;
  const allEntered = rows.length > 0 && entered === rows.length;

  const exportUrl = (type: string) =>
    `/api/export?type=${type}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col gap-5">
        {/* ---------- 日付選択 ---------- */}
        <section>
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#6b5e52] mb-2">
            <CalendarDays size={14} />
            見たい販売日
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              max={toJstDateString()}
              onChange={(e) => selectDate(e.target.value)}
              className="border border-[#e8e0d8] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
            />
            {[
              { label: "今日", value: toJstDateString() },
              { label: "昨日", value: daysAgo(1) },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => selectDate(q.value)}
                className={cn(
                  "px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors",
                  date === q.value
                    ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                    : "bg-white text-[#6b5e52] border-[#e8e0d8] hover:border-[#8B1A2C]"
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#6b5e52] mt-2">{formatJstDateLabel(date)} の記録</p>
        </section>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl h-64 animate-pulse border border-[#e8e0d8]" />
        ) : !day ? (
          <p className="text-center text-sm text-[#6b5e52] bg-white border border-[#e8e0d8] rounded-2xl py-12">
            この日の記録はありません
          </p>
        ) : (
          <>
            {/* ---------- その日の数字 ---------- */}
            <section>
              <h2 className="font-black text-[#1a1a1a] text-base mb-2">売上と販売数</h2>
              <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f5f0eb] text-[#6b5e52] text-xs">
                      <th className="text-left font-bold px-3 py-2"></th>
                      <th className="text-right font-bold px-3 py-2">予約</th>
                      <th className="text-right font-bold px-3 py-2">飛び込み</th>
                      <th className="text-right font-bold px-3 py-2">合計</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    <tr className="border-t border-[#e8e0d8]">
                      <th className="text-left font-medium px-3 py-2.5">売上金</th>
                      <td className="text-right px-3 py-2.5">{formatPrice(day.reservedRevenue)}</td>
                      <td className="text-right px-3 py-2.5">{formatPrice(day.walkInRevenue)}</td>
                      <td className="text-right px-3 py-2.5 font-black text-[#8B1A2C]">
                        {formatPrice(day.totalRevenue)}
                      </td>
                    </tr>
                    <tr className="border-t border-[#e8e0d8]">
                      <th className="text-left font-medium px-3 py-2.5">販売個数</th>
                      <td className="text-right px-3 py-2.5">{day.reservedSoldQty}個</td>
                      <td className="text-right px-3 py-2.5">{day.walkInSoldQty}個</td>
                      <td className="text-right px-3 py-2.5 font-black text-[#8B1A2C]">
                        {day.totalSoldQty}個
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#e8e0d8] border-t border-[#e8e0d8]">
                  {[
                    { label: "発注数", value: `${day.plannedQty}` },
                    { label: "残数", value: `${day.remainingStock}` },
                    { label: "受け取り済", value: `${day.completedCount}件` },
                    { label: "解放した数", value: `${day.releasedQty}` },
                    { label: "上限到達", value: `${day.capReachedCount}` },
                    { label: "売切で断り", value: `${day.turnawayCount}人` },
                  ].map((s) => (
                    <div key={s.label} className="bg-white px-2 py-2.5 text-center">
                      <p className="text-lg font-black text-[#1a1a1a] tabular-nums leading-tight">
                        {s.value}
                      </p>
                      <p className="text-[10px] text-[#6b5e52] leading-tight mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-[#6b5e52] mt-2">
                無断不受け取り {day.releasedCount}件
                {day.noShowRate !== null && `（${(day.noShowRate * 100).toFixed(1)}%）`}
                ・最初の売り切れ {jstTime(day.firstSoldOutAt)}
              </p>
            </section>

            {/* ---------- 閉店処理 ---------- */}
            <section>
              <h2 className="font-black text-[#1a1a1a] text-base mb-1 flex items-center gap-2">
                <DoorClosed size={16} className="text-[#8B1A2C]" />
                閉店時の残数
              </h2>
              <p className="text-xs text-[#6b5e52] mb-2">
                売れ残った数を入力します。入力はそのまま保存され、日付を切り替えても残ります。
              </p>

              {rows.length === 0 ? (
                <p className="text-center text-sm text-[#6b5e52] bg-white border border-[#e8e0d8] rounded-2xl py-6">
                  この日は発注がありません
                </p>
              ) : (
                <>
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 mb-2 text-xs font-bold border",
                      allEntered
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-white border-[#e8e0d8] text-[#6b5e52]"
                    )}
                  >
                    {allEntered
                      ? `入力完了：全${rows.length}商品`
                      : `入力状況：${entered} / ${rows.length} 商品`}
                  </div>

                  <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#f5f0eb] text-[#6b5e52] text-xs">
                          <th className="text-left font-bold px-3 py-2">商品名</th>
                          <th className="text-right font-bold px-3 py-2">発注</th>
                          <th className="text-right font-bold px-3 py-2">予約</th>
                          <th className="text-right font-bold px-3 py-2">飛込</th>
                          <th className="text-right font-bold px-3 py-2">記録上</th>
                          <th className="text-right font-bold px-3 py-2 w-24">実際の残数</th>
                          <th className="text-right font-bold px-3 py-2">ずれ</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {CATEGORIES.map((cat) => {
                          const catRows = rows.filter((r) => r.category === cat);
                          if (catRows.length === 0) return null;
                          return (
                            <Fragment key={cat}>
                              <tr className="bg-[#fdf8f3]">
                                <td
                                  colSpan={7}
                                  className="px-3 py-1.5 text-xs font-bold text-[#8B1A2C] border-t border-[#e8e0d8]"
                                >
                                  {CATEGORY_LABELS[cat]}
                                </td>
                              </tr>
                              {catRows.map((row) => {
                                const draft = drafts[row.productId];
                                const shown =
                                  draft !== undefined
                                    ? draft
                                    : row.closingQty === null
                                    ? ""
                                    : String(row.closingQty);
                                return (
                                  <tr key={row.productId} className="border-t border-[#e8e0d8]">
                                    <td className="px-3 py-2 font-medium text-[#1a1a1a]">
                                      {row.productName}
                                    </td>
                                    <td className="px-3 py-2 text-right text-[#6b5e52]">
                                      {row.plannedQty}
                                    </td>
                                    <td className="px-3 py-2 text-right text-[#6b5e52]">
                                      {row.handedOverQty}
                                    </td>
                                    <td className="px-3 py-2 text-right text-[#6b5e52]">
                                      {row.walkInSoldQty}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-[#1a1a1a]">
                                      {row.remainingStock}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <input
                                          type="number"
                                          min={0}
                                          max={row.plannedQty}
                                          value={shown}
                                          placeholder="—"
                                          onChange={(e) =>
                                            setDrafts((prev) => ({
                                              ...prev,
                                              [row.productId]: e.target.value,
                                            }))
                                          }
                                          onBlur={(e) => {
                                            if (e.target.value === "") return;
                                            saveClosingQty(
                                              row.productId,
                                              Math.max(0, parseInt(e.target.value, 10) || 0),
                                              row.plannedQty,
                                              row.productName
                                            );
                                          }}
                                          className="w-16 border border-[#e8e0d8] rounded-lg px-2 py-1 text-right text-sm font-black bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                                        />
                                        {savedId === row.productId && (
                                          <Check size={14} className="text-green-600" />
                                        )}
                                      </div>
                                    </td>
                                    <td
                                      className={cn(
                                        "px-3 py-2 text-right font-bold",
                                        row.countDiff === null
                                          ? "text-[#6b5e52]"
                                          : row.countDiff === 0
                                          ? "text-green-700"
                                          : "text-orange-700"
                                      )}
                                    >
                                      {row.countDiff === null
                                        ? "—"
                                        : row.countDiff > 0
                                        ? `+${row.countDiff}`
                                        : row.countDiff}
                                    </td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-[#6b5e52] mt-2 flex items-start gap-1.5">
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                    「ずれ」は実際の残数と記録上の残数の差です。0でなければ、店頭で売れたときの
                    ボタンの押し忘れか数え間違いがあります。
                  </p>
                </>
              )}
            </section>
          </>
        )}

        {/* ---------- CSV ---------- */}
        <section>
          <h2 className="font-black text-[#1a1a1a] text-base mb-2">CSV書き出し</h2>
          <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3 mb-3">
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
            <div className="flex flex-wrap gap-2">
              {[
                { type: "metrics", label: "指標（商品×販売日）" },
                { type: "orders", label: "予約明細" },
                { type: "walkin", label: "飛び込み販売明細" },
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
        </section>
      </div>
    </div>
  );
}
