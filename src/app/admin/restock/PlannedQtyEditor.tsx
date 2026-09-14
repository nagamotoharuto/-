"use client";

import { Fragment, useEffect, useState } from "react";
import { CalendarDays, Check, Package } from "lucide-react";
import {
  cn,
  formatJstDateLabel,
  getNextBusinessDay,
  getReservableQty,
  RESERVATION_RATIO,
  toJstDateString,
} from "@/lib/utils";

interface AvailabilityItem {
  id: string;
  name: string;
  category: string;
  plannedQty: number;
  reservableQty: number;
  reservedQty: number;
  remainingQty: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  bread: "パン",
  drink: "ドリンク",
  goods: "グッズ",
};

const CATEGORY_ORDER = ["bread", "drink", "goods"];

/**
 * 販売日ごとの発注数を設定する。
 *
 * The bakery fixes a sale day's line-up on the previous business day, which is
 * what lets customers reserve a day ahead — so this is where staff enter the
 * next business day's quantities. RESERVATION_RATIO of each becomes bookable;
 * the rest stays on the shelf for walk-ups.
 */
export default function PlannedQtyEditor() {
  // Both helpers read wall-clock JST, so server and client agree on these
  const [dates] = useState<string[]>(() => [toJstDateString(), getNextBusinessDay()]);
  // Default to the next business day: that is the one staff are deciding on
  const [date, setDate] = useState(() => getNextBusinessDay());
  const [items, setItems] = useState<AvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Bumped to re-pull the sale date's figures (e.g. after a failed save)
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/daily-stock?date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("発注数の読み込みに失敗しました");
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

  async function savePlannedQty(productId: string, plannedQty: number) {
    if (plannedQty < 0) return;
    setSavingId(productId);
    setError("");

    // Optimistic: recompute the derived quota locally so the row updates instantly
    setItems((prev) =>
      prev.map((item) =>
        item.id === productId
          ? {
              ...item,
              plannedQty,
              reservableQty: getReservableQty(plannedQty),
              remainingQty: Math.max(0, getReservableQty(plannedQty) - item.reservedQty),
            }
          : item
      )
    );

    try {
      const res = await fetch("/api/daily-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, date, plannedQty }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "発注数の保存に失敗しました");
        setReloadKey((k) => k + 1);
        return;
      }
      setSavedId(productId);
      setTimeout(() => setSavedId((current) => (current === productId ? null : current)), 1500);
    } catch {
      setError("通信エラーが発生しました");
      setReloadKey((k) => k + 1);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-6 print:hidden">
      <h2 className="font-bold text-[#1a1a1a] mb-1 flex items-center gap-2">
        <Package size={16} className="text-[#8B1A2C]" />
        販売日ごとの発注数
      </h2>
      <p className="text-xs text-[#6b5e52] mb-3">
        入力した発注数の{Math.round(RESERVATION_RATIO * 100)}%が予約枠になります。
        残り{Math.round((1 - RESERVATION_RATIO) * 100)}%は飛び込みのお客様用に店頭へ確保されます。
        次の営業日分をここで決めておくと、お客様は前営業日から予約できます。
      </p>

      {/* Sale date tabs */}
      <div className="flex gap-2 mb-4">
        {dates.map((d) => (
          <button
            key={d}
            onClick={() => selectDate(d)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
              date === d
                ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                : "bg-white text-[#6b5e52] border-[#e8e0d8] hover:border-[#8B1A2C]"
            )}
          >
            <CalendarDays size={13} />
            {formatJstDateLabel(d)}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-11 bg-[#f5f0eb] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-center text-[#6b5e52] py-6">商品が登録されていません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f5f0eb] text-[#6b5e52] text-xs">
                <th className="text-left font-bold px-3 py-2">商品名</th>
                <th className="text-right font-bold px-3 py-2 w-24">発注数</th>
                <th className="text-right font-bold px-3 py-2">予約枠</th>
                <th className="text-right font-bold px-3 py-2">予約済</th>
                <th className="text-right font-bold px-3 py-2">残り</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((cat) => {
                const catItems = items.filter((i) => i.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <Fragment key={cat}>
                    <tr className="bg-[#fdf8f3]">
                      <td
                        colSpan={5}
                        className="px-3 py-1.5 text-xs font-bold text-[#8B1A2C] border-t border-[#e8e0d8]"
                      >
                        {CATEGORY_LABELS[cat] ?? cat}
                      </td>
                    </tr>
                      {catItems.map((item) => (
                        <tr key={item.id} className="border-t border-[#e8e0d8]">
                          <td className="px-3 py-2 font-medium text-[#1a1a1a]">{item.name}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min={0}
                                value={item.plannedQty}
                                disabled={savingId === item.id}
                                onChange={(e) => {
                                  const next = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  setItems((prev) =>
                                    prev.map((p) =>
                                      p.id === item.id ? { ...p, plannedQty: next } : p
                                    )
                                  );
                                }}
                                onBlur={(e) =>
                                  savePlannedQty(
                                    item.id,
                                    Math.max(0, parseInt(e.target.value, 10) || 0)
                                  )
                                }
                                className="w-16 border border-[#e8e0d8] rounded-lg px-2 py-1 text-right text-sm bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] disabled:opacity-50"
                              />
                              {savedId === item.id && (
                                <Check size={14} className="text-green-600 flex-shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-[#8B1A2C]">
                            {item.reservableQty}
                          </td>
                          <td className="px-3 py-2 text-right text-[#6b5e52]">{item.reservedQty}</td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-bold",
                              item.remainingQty === 0 ? "text-red-600" : "text-[#1a1a1a]"
                            )}
                          >
                            {item.remainingQty}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
