"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, ChefHat, Loader2 } from "lucide-react";
import { useBakeryStore } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  content: string;
  typing?: boolean;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "こんにちは！🥐 今日のおすすめを聞いてみてください。\n「甘いもの」「さっぱりしたもの」「お腹いっぱいになりたい」など、お好みを教えてもらえればぴったりの商品をご紹介します！",
};

const SUGGESTIONS = ["甘いものが食べたい", "さっぱりしたもの", "お腹いっぱいになりたい"];

// Typewriter effect: reveal text character by character
async function typewriter(
  fullText: string,
  onUpdate: (text: string) => void,
  signal: AbortSignal
) {
  const CHUNK = 4; // characters per tick
  const DELAY = 25; // ms per tick
  let displayed = "";
  for (let i = 0; i < fullText.length; i += CHUNK) {
    if (signal.aborted) break;
    displayed += fullText.slice(i, i + CHUNK);
    onUpdate(displayed);
    await new Promise((r) => setTimeout(r, DELAY));
  }
  onUpdate(fullText);
}

export default function ChatWidget() {
  const pathname = usePathname();
  const { user } = useBakeryStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Hide on staff pages (after all hooks)
  if (pathname.startsWith("/staff")) return null;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Cancel any in-progress typewriter
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userMsg: Message = { role: "user", content: trimmed };
    const botMsg: Message = { role: "assistant", content: "", typing: true };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
    setLoading(true);

    const history = messages
      .filter((m) => !m.typing)
      .slice(1)
      .map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, nickname: user?.nickname ?? null, history }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errText = data.error ?? "エラーが発生しました。もう一度お試しください。";
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 ? { role: "assistant", content: errText } : m
          )
        );
        return;
      }

      // Typewriter reveal
      await typewriter(
        data.content,
        (partial) => {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1
                ? { role: "assistant", content: partial, typing: true }
                : m
            )
          );
        },
        ac.signal
      );

      // Mark typing done
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, typing: false } : m
        )
      );
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { role: "assistant", content: "通信エラーが発生しました。もう一度お試しください。" }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const showSuggestions = messages.length === 1 && !loading;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end pointer-events-none">
          <div
            className="absolute inset-0 bg-black/30 pointer-events-auto"
            onClick={() => setOpen(false)}
          />

          <div
            className="relative pointer-events-auto bg-white rounded-t-3xl shadow-2xl flex flex-col"
            style={{ height: "82vh", maxHeight: "640px" }}
          >
            {/* Header */}
            <div className="bg-[#1a4d2e] text-white px-4 py-3 rounded-t-3xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#c8843a] rounded-full flex items-center justify-center">
                  <ChefHat size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">おすすめアシスタント</p>
                  <p className="text-xs text-green-200 leading-tight">AIが在庫から厳選してご提案</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 bg-[#c8843a] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ChefHat size={13} className="text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[#1a4d2e] text-white rounded-br-sm"
                        : "bg-[#f5f0eb] text-[#1a1a1a] rounded-bl-sm"
                    }`}
                  >
                    {msg.typing && !msg.content ? (
                      <span className="flex items-center gap-1.5 text-[#6b5e52]">
                        <Loader2 size={14} className="animate-spin" />
                        考え中...
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Quick suggestions */}
            {showSuggestions && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap flex-shrink-0">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs bg-[#f5f0eb] text-[#1a4d2e] px-3 py-1.5 rounded-full border border-[#e8e0d8] hover:bg-[#1a4d2e] hover:text-white transition-colors font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-[#e8e0d8] flex gap-2 flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="好みを教えてください..."
                disabled={loading}
                className="flex-1 border border-[#e8e0d8] rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d2e] bg-[#fdf8f3] disabled:opacity-60"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-11 h-11 bg-[#1a4d2e] text-white rounded-2xl flex items-center justify-center hover:bg-[#2d6b42] transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-30 w-14 h-14 bg-[#1a4d2e] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[#2d6b42] transition-all active:scale-95"
        aria-label="おすすめアシスタントを開く"
      >
        <MessageCircle size={24} />
      </button>
    </>
  );
}
