"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, Download, MessageSquare } from "lucide-react";
import {
  cn,
  OPINION_CATEGORIES,
  OPINION_CATEGORY_LABELS,
  OPINION_SOURCE_LABELS,
} from "@/lib/utils";
import OpinionEntryForm from "@/components/features/OpinionEntryForm";

interface Opinion {
  id: string;
  category: string;
  body: string;
  source: string;
  createdAt: string;
  readAt: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  product: "bg-amber-100 text-amber-800",
  feature: "bg-blue-100 text-blue-800",
  other: "bg-gray-100 text-gray-600",
};

// 日本時間での日付でまとめる。サーバーの時刻帯に左右されないようにする。
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/**
 * 届いたご意見の記録。
 *
 * 既読にしても消えず、届いた日ごとにまとめて残り続ける。あとから
 * 読み返したり、研究の材料として書き出したりできるようにしている。
 * 匿名で受け取っているので、誰が書いたかは分からない。
 *
 * 口頭でいただいたご要望も同じ並びに入る。どちらから届いたかは札で
 * 分かるようにしてあり、アプリを使っていない層の声がどれだけあったかを
 * 後から数えられる。
 */
export default function OpinionList() {
  const [opinions, setOpinions] = useState<Opinion[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/opinions")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setOpinions(Array.isArray(data.opinions) ? data.opinions : []);
        setUnread(data.unreadCount ?? 0);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch("/api/opinions", { method: "PATCH" });
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  const shown =
    filter === "all"
      ? opinions
      : filter === "unread"
      ? opinions.filter((o) => !o.readAt)
      : filter.startsWith("source:")
      ? opinions.filter((o) => o.source === filter.slice("source:".length))
      : opinions.filter((o) => o.category === filter);

  // 届いた日ごとにまとめる。新しい日が上。
  const byDay = new Map<string, Opinion[]>();
  for (const o of shown) {
    const key = dayKey(o.createdAt);
    const list = byDay.get(key) ?? [];
    list.push(o);
    byDay.set(key, list);
  }

  const countOf = (cat: string) => opinions.filter((o) => o.category === cat).length;
  const staffCount = opinions.filter((o) => o.source === "staff").length;
  const appCount = opinions.length - staffCount;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-black text-[#1a1a1a] text-base flex items-center gap-2">
          <MessageSquare size={16} className="text-[#8B1A2C]" />
          お客様からのご意見
          {unread > 0 && (
            <span className="text-xs font-black text-white bg-[#F0AA5A] rounded-full px-2 py-0.5">
              未読 {unread}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {opinions.length > 0 && (
            <a
              href="/api/export?type=opinions"
              className="flex items-center gap-1 text-xs font-bold text-[#8B1A2C] bg-white border border-[#e8e0d8] rounded-lg px-3 py-2 hover:border-[#8B1A2C] transition-colors"
            >
              <Download size={13} />
              CSV
            </a>
          )}
          {unread > 0 && (
            <button
              onClick={markAllRead}
              disabled={busy}
              className="flex items-center gap-1 text-xs font-bold text-[#8B1A2C] bg-white border border-[#e8e0d8] rounded-lg px-3 py-2 hover:border-[#8B1A2C] disabled:opacity-50 transition-colors"
            >
              <Check size={13} />
              すべて読んだ
            </button>
          )}
        </div>
      </div>

      <OpinionEntryForm onSaved={() => setReloadKey((k) => k + 1)} />

      {/* これまでに届いた総数と内訳。記録として積み上がっていることが分かるように。 */}
      {opinions.length > 0 && (
        <div className="bg-white border border-[#e8e0d8] rounded-2xl px-4 py-3 mb-2">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-2xl font-black text-[#8B1A2C] tabular-nums">
              {opinions.length}
            </span>
            <span className="text-xs text-[#6b5e52]">件のご意見が届いています</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6b5e52]">
            {OPINION_CATEGORIES.map((c) => (
              <span key={c}>
                {OPINION_CATEGORY_LABELS[c]}{" "}
                <strong className="text-[#1a1a1a] tabular-nums">{countOf(c)}</strong>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6b5e52] mt-1 pt-1.5 border-t border-[#f0ebe4]">
            <span>
              アプリから <strong className="text-[#1a1a1a] tabular-nums">{appCount}</strong>
            </span>
            <span>
              口頭で <strong className="text-[#1a1a1a] tabular-nums">{staffCount}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        {[
          { value: "all", label: `すべて ${opinions.length}` },
          { value: "unread", label: `未読 ${unread}` },
          ...OPINION_CATEGORIES.map((c) => ({
            value: c,
            label: `${OPINION_CATEGORY_LABELS[c]} ${countOf(c)}`,
          })),
          { value: "source:app", label: `アプリから ${appCount}` },
          { value: "source:staff", label: `口頭で ${staffCount}` },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
              filter === f.value
                ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                : "bg-white text-[#6b5e52] border-[#e8e0d8]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-32 bg-white rounded-2xl border border-[#e8e0d8] animate-pulse" />
      ) : shown.length === 0 ? (
        <p className="text-center text-sm text-[#6b5e52] bg-white border border-[#e8e0d8] rounded-2xl py-8">
          {opinions.length === 0
            ? "まだご意見は届いていません"
            : "この条件に当てはまるご意見はありません"}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {[...byDay.entries()].map(([day, items]) => (
            <Fragment key={day}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#8B1A2C]">{dayLabel(items[0].createdAt)}</span>
                <span className="text-[10px] text-[#6b5e52]">{items.length}件</span>
                <span className="flex-1 h-px bg-[#e8e0d8]" />
              </div>

              {items.map((o) => (
                <div
                  key={o.id}
                  className={cn(
                    "rounded-2xl border shadow-sm px-4 py-3",
                    o.readAt ? "bg-white border-[#e8e0d8]" : "bg-[#fff8ee] border-[#F0AA5A]"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        CATEGORY_COLORS[o.category] ?? CATEGORY_COLORS.other
                      )}
                    >
                      {OPINION_CATEGORY_LABELS[o.category] ?? o.category}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        o.source === "staff"
                          ? "text-[#8B1A2C] bg-[#f7eef0] border-[#e4ccd2]"
                          : "text-[#6b5e52] bg-white border-[#e8e0d8]"
                      )}
                    >
                      {OPINION_SOURCE_LABELS[o.source] ?? o.source}
                    </span>
                    {!o.readAt && (
                      <span className="text-[10px] font-black text-white bg-[#F0AA5A] rounded-full px-2 py-0.5">
                        未読
                      </span>
                    )}
                    <span className="text-[10px] text-[#6b5e52] ml-auto tabular-nums">
                      {new Date(o.createdAt).toLocaleTimeString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
                    {o.body}
                  </p>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}

      <p className="text-xs text-[#6b5e52] mt-2">
        既読にしても消えません。届いた日ごとに記録として残ります。
        匿名で届くため、どなたが書いたかは分かりません。
        「口頭」は販売員が直接お聞きして書き留めたもので、書いた時点で確認済みになります。
      </p>
    </section>
  );
}
