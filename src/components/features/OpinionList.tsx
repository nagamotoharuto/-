"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Check } from "lucide-react";
import { cn, OPINION_CATEGORY_LABELS } from "@/lib/utils";

interface Opinion {
  id: string;
  category: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  product: "bg-amber-100 text-amber-800",
  feature: "bg-blue-100 text-blue-800",
  other: "bg-gray-100 text-gray-600",
};

/**
 * お客様から届いたご意見の一覧。
 *
 * 匿名で受け取っているので、誰が書いたかは分からない。未読だけ色を変え、
 * 「読んだ」を押すとまとめて既読にする。
 */
export default function OpinionList() {
  const [opinions, setOpinions] = useState<Opinion[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");

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

  const shown = filter === "unread" ? opinions.filter((o) => !o.readAt) : opinions;

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

      <div className="flex gap-2 mb-2">
        {[
          { value: "all", label: `すべて ${opinions.length}` },
          { value: "unread", label: `未読 ${unread}` },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as "all" | "unread")}
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
          {filter === "unread" ? "未読のご意見はありません" : "まだご意見は届いていません"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((o) => (
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
                {!o.readAt && (
                  <span className="text-[10px] font-black text-white bg-[#F0AA5A] rounded-full px-2 py-0.5">
                    未読
                  </span>
                )}
                <span className="text-[10px] text-[#6b5e52] ml-auto tabular-nums">
                  {new Date(o.createdAt).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">{o.body}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[#6b5e52] mt-2">
        匿名で届くため、どなたが書いたかは分かりません。返信もできません。
      </p>
    </section>
  );
}
