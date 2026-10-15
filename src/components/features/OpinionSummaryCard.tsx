"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";

/**
 * 記録の画面に置く、ご意見への入口。
 *
 * 中身は別の画面に移したので、ここでは「何件あって、まだ読んでいないものが
 * あるか」だけを出す。読むべきものがあることに気づければ足りる。
 */
export default function OpinionSummaryCard() {
  const [total, setTotal] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/opinions")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTotal(Array.isArray(data.opinions) ? data.opinions.length : 0);
        setUnread(data.unreadCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setTotal(0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/admin/opinions"
      className="flex items-center gap-3 bg-white border border-[#e8e0d8] rounded-2xl shadow-sm px-4 py-3.5 hover:border-[#8B1A2C] transition-colors"
    >
      <MessageSquare size={18} className="text-[#8B1A2C] flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="font-black text-[#1a1a1a] text-sm flex items-center gap-2">
          お客様からのご意見
          {unread > 0 && (
            <span className="text-[10px] font-black text-white bg-[#F0AA5A] rounded-full px-2 py-0.5">
              未読 {unread}
            </span>
          )}
        </p>
        <p className="text-xs text-[#6b5e52] mt-0.5">
          {total === null
            ? "読み込んでいます…"
            : total === 0
            ? "まだ届いていません。口頭でお聞きしたご要望もここに書けます"
            : `これまでに ${total} 件。口頭でお聞きしたご要望もここに書けます`}
        </p>
      </div>

      <ChevronRight size={18} className="text-[#6b5e52] flex-shrink-0" />
    </Link>
  );
}
