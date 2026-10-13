"use client";

import { useState } from "react";
import { Check, MessageSquarePlus, Send, Star } from "lucide-react";
import {
  cn,
  OPINION_CATEGORIES,
  OPINION_CATEGORY_LABELS,
  OPINION_MAX_LENGTH,
} from "@/lib/utils";

/**
 * お店へのご意見箱。
 *
 * 名前もメールも送らない。誰が書いたか分からないからこそ本音が出るので、
 * 匿名であることを画面にも明記している。
 */
export default function OpinionBox({
  nickname,
  onStampGranted,
}: {
  nickname?: string;
  onStampGranted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("product");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [stampAdded, setStampAdded] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("ご意見を入力してください");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/opinions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 名前はお礼のスタンプを押すためだけに送る。ご意見の記録には残らない。
        body: JSON.stringify({ category, body: trimmed, nickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました");
        return;
      }
      setText("");
      setSent(true);
      setStampAdded(Boolean(data.stampAdded));
      setOpen(false);
      if (data.stampAdded) onStampGranted?.();
      setTimeout(() => setSent(false), 6000);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => {
          setOpen((v) => !v);
          setError("");
        }}
      >
        <h2 className="font-bold text-[#1a1a1a] flex items-center gap-2">
          <MessageSquarePlus size={16} className="text-[#8B1A2C]" />
          お店へのご意見
        </h2>
        <span className="text-xs font-bold text-[#8B1A2C]">{open ? "閉じる" : "書く"}</span>
      </button>

      {sent && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-3 py-2.5 mt-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Check size={16} className="flex-shrink-0" />
            送信しました。ありがとうございます
          </p>
          <p className="flex items-center gap-1.5 text-xs mt-1.5">
            <Star size={13} className="flex-shrink-0 fill-current" />
            {stampAdded
              ? "お礼にスタンプを1個お押ししました"
              : "スタンプは1日1個までです。また明日お聞かせください"}
          </p>
        </div>
      )}

      {!open && !sent && (
        <p className="text-xs text-[#6b5e52] mt-2">
          取り扱ってほしい商品や、アプリへの要望をお聞かせください。匿名で届きます。
          お礼にスタンプを1個お押しします（1日1個まで）。
        </p>
      )}

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-bold text-[#6b5e52] mb-1.5">種類</label>
            <div className="flex flex-wrap gap-2">
              {OPINION_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
                    category === c
                      ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                      : "bg-white text-[#6b5e52] border-[#e8e0d8] hover:border-[#8B1A2C]"
                  )}
                >
                  {OPINION_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#6b5e52] mb-1.5">ご意見</label>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, OPINION_MAX_LENGTH));
                setError("");
              }}
              rows={5}
              placeholder="例：クロワッサンをもっと増やしてほしいです"
              className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2.5 text-sm bg-[#fdf8f3] resize-none focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
            />
            <p className="text-[10px] text-[#6b5e52] text-right mt-1 tabular-nums">
              {text.length} / {OPINION_MAX_LENGTH}
            </p>
          </div>

          <p className="text-[11px] text-[#6b5e52] bg-[#f5f0eb] rounded-xl px-3 py-2 leading-relaxed">
            お名前・メールアドレスなどは送信されません。どなたが書いたかは分からない形で
            お店に届きます。返信はできませんのでご了承ください。
          </p>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={sending || !text.trim()}
            className="flex items-center justify-center gap-2 bg-[#8B1A2C] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#A52235] disabled:opacity-40 transition-colors"
          >
            <Send size={15} />
            {sending ? "送信中..." : "匿名で送信する"}
          </button>
        </div>
      )}
    </div>
  );
}
