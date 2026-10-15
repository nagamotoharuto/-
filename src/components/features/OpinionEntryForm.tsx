"use client";

import { useState } from "react";
import { Check, PenLine, Send } from "lucide-react";
import {
  cn,
  OPINION_CATEGORIES,
  OPINION_CATEGORY_LABELS,
  OPINION_MAX_LENGTH,
} from "@/lib/utils";

/**
 * 口頭でいただいたご要望を販売員が書き留める欄。
 *
 * アプリを使っていないお客様の声は、その場で聞くしかない。言われたまま
 * ここに書いておけば、アプリから匿名で届いたご意見と同じ記録に並ぶ。
 *
 * 誰が言ったかは書かない。アプリ側と同じく匿名のまま残す。
 */
export default function OpinionEntryForm({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("product");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("内容を入力してください");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/opinions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, body: trimmed, source: "staff" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      setText("");
      setSaved(true);
      setOpen(false);
      onSaved?.();
      setTimeout(() => setSaved(false), 6000);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-2">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => {
          setOpen((v) => !v);
          setError("");
        }}
      >
        <span className="font-bold text-[#1a1a1a] text-sm flex items-center gap-2">
          <PenLine size={15} className="text-[#8B1A2C]" />
          口頭でいただいたご要望を書き留める
        </span>
        <span className="text-xs font-bold text-[#8B1A2C]">{open ? "閉じる" : "書く"}</span>
      </button>

      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-3 py-2.5 mt-3 text-sm font-bold">
          <Check size={16} className="flex-shrink-0" />
          記録しました
        </div>
      )}

      {!open && !saved && (
        <p className="text-xs text-[#6b5e52] mt-2 leading-relaxed">
          お客様から直接お聞きしたご要望を、言われたまま書いてください。
          下の記録に「口頭」として並びます。お名前は書かないでください。
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
            <label className="block text-xs font-bold text-[#6b5e52] mb-1.5">言われた内容</label>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, OPINION_MAX_LENGTH));
                setError("");
              }}
              rows={4}
              placeholder="例：あんぱんも置いてほしいと言われた"
              className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2.5 text-sm bg-[#fdf8f3] resize-none focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
            />
            <p className="text-[10px] text-[#6b5e52] text-right mt-1 tabular-nums">
              {text.length} / {OPINION_MAX_LENGTH}
            </p>
          </div>

          <p className="text-[11px] text-[#6b5e52] bg-[#f5f0eb] rounded-xl px-3 py-2 leading-relaxed">
            お客様のお名前や、どなたか分かる書き方は避けてください。
            アプリから届くご意見と同じく、匿名のまま記録します。
          </p>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={saving || !text.trim()}
            className="flex items-center justify-center gap-2 bg-[#8B1A2C] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#A52235] disabled:opacity-40 transition-colors"
          >
            <Send size={15} />
            {saving ? "保存中..." : "記録する"}
          </button>
        </div>
      )}
    </div>
  );
}
