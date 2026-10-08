"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarDays, ImageOff } from "lucide-react";
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
 * 今週の月〜金に売るパンの一覧。
 *
 * パンは曜日ごとにほぼ決まっているので、発注がまだ入っていない日は前回の
 * 同じ曜日の品揃えを「目安」として出す。確定した日とは見た目で区別する。
 */
export default function WeeklyMenu() {
  const [days, setDays] = useState<MenuDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

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

  if (loading) {
    return <div className="h-48 bg-white rounded-2xl border border-[#e8e0d8] animate-pulse mb-6" />;
  }

  if (days.every((d) => d.items.length === 0)) return null;

  return (
    <section className="mb-6">
      <h2 className="flex items-center gap-2 text-sm font-black text-[#1a1a1a] mb-1">
        <CalendarDays size={16} className="text-[#8B1A2C]" />
        今週のパン
      </h2>
      <p className="text-xs text-[#6b5e52] mb-3">
        曜日ごとに並ぶパンが変わります。仕入れの都合で変更になる場合があります。
      </p>

      <div className="flex flex-col gap-2">
        {days.map((day) => {
          const [, month, dd] = day.date.split("-");
          return (
            <div
              key={day.date}
              className={cn(
                "bg-white rounded-2xl border shadow-sm overflow-hidden",
                day.isToday ? "border-[#8B1A2C] ring-1 ring-[#8B1A2C]/30" : "border-[#e8e0d8]"
              )}
            >
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[#e8e0d8] bg-[#fdf8f3]">
                <span
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0",
                    day.isToday ? "bg-[#8B1A2C] text-white" : "bg-[#e8e0d8] text-[#6b5e52]"
                  )}
                >
                  {WEEKDAY_LABELS[day.weekday]}
                </span>
                <span className="text-xs font-bold text-[#1a1a1a] tabular-nums">
                  {Number(month)}/{Number(dd)}
                </span>
                {day.isToday && (
                  <span className="text-[10px] font-black text-[#8B1A2C] bg-[#8B1A2C]/10 px-2 py-0.5 rounded-full">
                    本日
                  </span>
                )}
                {!day.isConfirmed && day.items.length > 0 && (
                  <span className="text-[10px] font-bold text-[#6b5e52] bg-[#f5f0eb] border border-[#e8e0d8] px-2 py-0.5 rounded-full ml-auto">
                    いつもの目安
                  </span>
                )}
              </div>

              {day.items.length === 0 ? (
                <p className="px-4 py-3 text-xs text-[#6b5e52]">
                  {day.isBusinessDay ? "準備中です" : "お休みです"}
                </p>
              ) : (
                <div className="flex gap-3 px-4 py-3 overflow-x-auto">
                  {day.items.map((item) => (
                    <div key={item.id} className="flex-shrink-0 w-20">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#f5f0eb] mb-1">
                        {item.imageUrl && !broken[item.id] ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                            onError={() => setBroken((p) => ({ ...p, [item.id]: true }))}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[#c8bdb5]">
                            <ImageOff size={18} />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-[#1a1a1a] leading-tight line-clamp-2">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-[#6b5e52]">{formatPrice(item.price)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
