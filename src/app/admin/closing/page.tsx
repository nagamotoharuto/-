"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorClosed, Check, CalendarDays, AlertTriangle } from "lucide-react";
import StaffHeader from "@/components/features/StaffHeader";
import {
  cn,
  formatJstDateLabel,
  getPreviousBusinessDay,
  isWithinSalesHours,
  toJstDateString,
} from "@/lib/utils";

interface ClosingRow {
  id: string;
  name: string;
  category: string;
  plannedQty: number;
  handedOverQty: number;
  releasedQty: number;
  closingQty: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  bread: "パン",
  drink: "ドリンク",
  goods: "グッズ",
};

const CATEGORY_ORDER = ["bread", "drink", "goods"];

/**
 * 閉店処理：その日の売れ残りを商品ごとに入力する。
 *
 * 発注数 − 残数 = 実売数、実売数 − 予約受け渡し数 = 飛び込み販売数 となり、
 * 解放した分が実際に売れたかどうかもここで初めて分かる。研究の【運用試験】で
 * 集める「解放分の販売率」はこの入力が前提になる。
 */
export default function ClosingPage() {
  const router = useRouter();
  const [dates] = useState<string[]>(() => [toJstDateString(), getPreviousBusinessDay()]);
  const [date, setDate] = useState(() => toJstDateString());
  const [rows, setRows] = useState<ClosingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`/api/daily-stock?date=${encodeURIComponent(date)}`).then((r) => r.json()),
      fetch(`/api/metrics?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`).then(
        (r) => r.json()
      ),
    ])
      .then(([stock, metrics]) => {
        if (cancelled) return;
        const day = metrics.days?.[0];
        const byProduct = new Map<string, { handedOverQty: number; releasedQty: number }>(
          (day?.items ?? []).map((i: { productId: string; handedOverQty: number; releasedQty: number }) => [
            i.productId,
            { handedOverQty: i.handedOverQty, releasedQty: i.releasedQty },
          ])
        );

        setRows(
          (stock.items ?? [])
            // 発注のあった商品だけが閉店時に棚にある
            .filter((i: { plannedQty: number }) => i.plannedQty > 0)
            .map((i: { id: string; name: string; category: string; plannedQty: number; closingQty: number | null }) => ({
              id: i.id,
              name: i.name,
              category: i.category,
              plannedQty: i.plannedQty,
              handedOverQty: byProduct.get(i.id)?.handedOverQty ?? 0,
              releasedQty: byProduct.get(i.id)?.releasedQty ?? 0,
              closingQty: i.closingQty ?? null,
            }))
        );
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("読み込みに失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  function selectDate(next: string) {
    if (next === date) return;
    setLoading(true);
    setDate(next);
  }

  async function saveClosingQty(row: ClosingRow, value: number) {
    const safe = Math.max(0, value);
    if (safe > row.plannedQty) {
      setError(`「${row.name}」の残数が発注数(${row.plannedQty}個)を超えています`);
      setReloadKey((k) => k + 1);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, closingQty: safe } : r)));
    setError("");

    const res = await fetch("/api/daily-stock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: row.id, date, closingQty: safe }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "保存に失敗しました");
      setReloadKey((k) => k + 1);
      return;
    }
    setSavedId(row.id);
    setTimeout(() => setSavedId((current) => (current === row.id ? null : current)), 1500);
  }

  const entered = rows.filter((r) => r.closingQty !== null).length;
  const allEntered = rows.length > 0 && entered === rows.length;
  const counterOpen = isWithinSalesHours() && date === toJstDateString();

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      <div className="max-w-2xl mx-auto px-4 py-4">
        <h1 className="font-black text-[#1a1a1a] text-lg flex items-center gap-2 mb-1">
          <DoorClosed size={18} className="text-[#8B1A2C]" />
          閉店処理
        </h1>
        <p className="text-xs text-[#6b5e52] mb-4">
          閉店時に売れ残った数を商品ごとに入力してください。
          発注数から差し引いて実売数と飛び込み販売数を算出し、解放した分が売れたかどうかの記録になります。
        </p>

        {/* Sale date */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-4">
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#6b5e52] mb-2">
            <CalendarDays size={14} />
            対象の販売日
          </label>
          <div className="flex gap-2">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => selectDate(d)}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors",
                  date === d
                    ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                    : "bg-white text-[#6b5e52] border-[#e8e0d8] hover:border-[#8B1A2C]"
                )}
              >
                {formatJstDateLabel(d)}
              </button>
            ))}
          </div>
        </div>

        {counterOpen && (
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl px-4 py-3 mb-4 text-xs">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              まだ営業時間中です。販売が終わってから入力してください（入力後に売れた場合は数え直しが必要です）
            </span>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {/* Progress */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 mb-4 text-xs font-bold border",
            allEntered
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-white border-[#e8e0d8] text-[#6b5e52]"
          )}
        >
          {rows.length === 0
            ? "この日は発注がありません"
            : allEntered
            ? `入力完了：全${rows.length}商品の残数が記録されました`
            : `入力状況：${entered} / ${rows.length} 商品（全商品そろうと解放分の販売率が算出されます）`}
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-[#f5f0eb] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? null : (
          <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f5f0eb] text-[#6b5e52] text-xs">
                    <th className="text-left font-bold px-3 py-2">商品名</th>
                    <th className="text-right font-bold px-3 py-2">発注数</th>
                    <th className="text-right font-bold px-3 py-2">受渡</th>
                    <th className="text-right font-bold px-3 py-2">解放</th>
                    <th className="text-right font-bold px-3 py-2 w-24">残数</th>
                    <th className="text-right font-bold px-3 py-2">実売数</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_ORDER.map((cat) => {
                    const catRows = rows.filter((r) => r.category === cat);
                    if (catRows.length === 0) return null;
                    return (
                      <Fragment key={cat}>
                        <tr className="bg-[#fdf8f3]">
                          <td
                            colSpan={6}
                            className="px-3 py-1.5 text-xs font-bold text-[#8B1A2C] border-t border-[#e8e0d8]"
                          >
                            {CATEGORY_LABELS[cat] ?? cat}
                          </td>
                        </tr>
                        {catRows.map((row) => {
                          const sold = row.closingQty === null ? null : row.plannedQty - row.closingQty;
                          return (
                            <tr key={row.id} className="border-t border-[#e8e0d8]">
                              <td className="px-3 py-2 font-medium text-[#1a1a1a]">{row.name}</td>
                              <td className="px-3 py-2 text-right text-[#6b5e52]">{row.plannedQty}</td>
                              <td className="px-3 py-2 text-right text-[#6b5e52]">{row.handedOverQty}</td>
                              <td className="px-3 py-2 text-right text-orange-700">{row.releasedQty}</td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    max={row.plannedQty}
                                    value={row.closingQty ?? ""}
                                    placeholder="—"
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      setRows((prev) =>
                                        prev.map((r) =>
                                          r.id === row.id
                                            ? {
                                                ...r,
                                                closingQty:
                                                  raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0),
                                              }
                                            : r
                                        )
                                      );
                                    }}
                                    onBlur={(e) => {
                                      if (e.target.value === "") return;
                                      saveClosingQty(row, Math.max(0, parseInt(e.target.value, 10) || 0));
                                    }}
                                    className="w-16 border border-[#e8e0d8] rounded-lg px-2 py-1 text-right text-sm font-black bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                                  />
                                  {savedId === row.id && <Check size={14} className="text-green-600" />}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-[#8B1A2C]">
                                {sold === null ? "—" : sold}
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
          </div>
        )}
      </div>
    </div>
  );
}
