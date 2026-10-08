"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CalendarDays } from "lucide-react";
import BottomNav from "@/components/features/BottomNav";
import { cn, formatPrice } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
}

interface MenuDay {
  date: string;
  weekday: number;
  isToday: boolean;
  isBusinessDay: boolean;
  isConfirmed: boolean;
  sourceDate: string | null;
  items: MenuItem[];
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 今週のパンを1枚の表で見せる。
 *
 * 行がパン、列が曜日。どの曜日に何が並ぶかを一目で比べられるので、
 * 来る日を選ぶのに使える。パンは曜日ごとにほぼ決まっているため、
 * 発注がまだの日は前回の同じ曜日から引いた目安を出す。
 */
export default function WeeklyPage() {
  const [days, setDays] = useState<MenuDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/weekly-menu")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDays(Array.isArray(data.days) ? data.days : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 週のどこかに出るパンを行にする。並びは最初に現れた順。
  const products = new Map<string, MenuItem>();
  for (const day of days) {
    for (const item of day.items) {
      if (!products.has(item.name)) products.set(item.name, item);
    }
  }
  const rows = [...products.values()];
  const hasEstimate = days.some((d) => !d.isConfirmed && d.items.length > 0);

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-20">
      <header className="bg-[#8B1A2C] text-white px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-[#A8C8F0] hover:text-white">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-[#F0AA5A]" />
          <span className="font-bold text-sm">今週のパン</span>
        </div>
      </header>

      <div className="max-w-md mx-auto w-full px-4 py-4 flex-1">
        <p className="text-xs text-[#6b5e52] mb-3">
          曜日ごとに並ぶパンが変わります。仕入れの都合で変更になる場合があります。
        </p>

        {loading ? (
          <div className="h-64 bg-white rounded-2xl border border-[#e8e0d8] animate-pulse" />
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-[#6b5e52] bg-white border border-[#e8e0d8] rounded-2xl py-12">
            今週の予定はまだ登録されていません
          </p>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f5f0eb]">
                    <th className="text-left text-xs font-bold text-[#6b5e52] px-3 py-2 sticky left-0 bg-[#f5f0eb]">
                      パン
                    </th>
                    {days.map((day) => {
                      const [, , dd] = day.date.split("-");
                      return (
                        <th
                          key={day.date}
                          className={cn(
                            "px-2 py-2 text-center w-11",
                            day.isToday ? "bg-[#8B1A2C] text-white" : "text-[#6b5e52]"
                          )}
                        >
                          <div className="text-xs font-black leading-tight">
                            {WEEKDAY_LABELS[day.weekday]}
                          </div>
                          <div className="text-[10px] font-normal leading-tight tabular-nums">
                            {Number(dd)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product) => (
                    <tr key={product.name} className="border-t border-[#e8e0d8]">
                      <th className="text-left font-medium text-[#1a1a1a] px-3 py-2.5 sticky left-0 bg-white">
                        <span className="block text-sm leading-tight">{product.name}</span>
                        <span className="block text-[10px] text-[#6b5e52]">
                          {formatPrice(product.price)}
                        </span>
                      </th>
                      {days.map((day) => {
                        const sold = day.items.some((i) => i.name === product.name);
                        return (
                          <td
                            key={day.date}
                            className={cn(
                              "text-center px-2 py-2.5",
                              day.isToday && "bg-[#8B1A2C]/5"
                            )}
                          >
                            {sold ? (
                              <span
                                className={cn(
                                  "text-base font-black",
                                  day.isConfirmed ? "text-[#8B1A2C]" : "text-[#c9a86c]"
                                )}
                                aria-label="販売あり"
                              >
                                ●
                              </span>
                            ) : (
                              <span className="text-[#e8e0d8]" aria-label="販売なし">
                                −
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-[#6b5e52]">
              <span className="flex items-center gap-1">
                <span className="text-[#8B1A2C] font-black">●</span> 販売予定
              </span>
              {hasEstimate && (
                <span className="flex items-center gap-1">
                  <span className="text-[#c9a86c] font-black">●</span> いつもの目安（発注前）
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="text-[#e8e0d8]">−</span> この日はなし
              </span>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
