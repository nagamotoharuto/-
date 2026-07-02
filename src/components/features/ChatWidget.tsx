"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Send, Loader2 } from "lucide-react";
import Image from "next/image";
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

const BUBBLE_MESSAGES = [
  "おすすめパンをご紹介します！",
  "今日のパン、一緒に選ぼう！",
  "何か食べたいものある？",
];

const BTN_SIZE = 64;
const EDGE_MARGIN = 12;
const POS_STORAGE_KEY = "norozy-button-pos";

function clampPos(x: number, y: number) {
  const maxX = window.innerWidth - BTN_SIZE - EDGE_MARGIN;
  const maxY = window.innerHeight - BTN_SIZE - EDGE_MARGIN;
  return {
    x: Math.min(Math.max(x, EDGE_MARGIN), Math.max(maxX, EDGE_MARGIN)),
    y: Math.min(Math.max(y, EDGE_MARGIN), Math.max(maxY, EDGE_MARGIN)),
  };
}

async function typewriter(
  fullText: string,
  onUpdate: (text: string) => void,
  signal: AbortSignal
) {
  const CHUNK = 4;
  const DELAY = 25;
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
  const [bubbleIdx, setBubbleIdx] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const movedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    const defaultPos = clampPos(
      window.innerWidth - BTN_SIZE - EDGE_MARGIN,
      window.innerHeight - BTN_SIZE - 96
    );
    try {
      const saved = localStorage.getItem(POS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPos(clampPos(parsed.x, parsed.y));
        return;
      }
    } catch {}
    setPos(defaultPos);
  }, []);

  useEffect(() => {
    function handleResize() {
      setPos((p) => (p ? clampPos(p.x, p.y) : p));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!pos) return;
    movedRef.current = false;
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
    setPos(clampPos(dragStartRef.current.posX + dx, dragStartRef.current.posY + dy));
  }

  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (!movedRef.current) {
      setOpen(true);
      return;
    }
    setPos((p) => {
      if (!p) return p;
      const snappedX =
        p.x + BTN_SIZE / 2 < window.innerWidth / 2
          ? EDGE_MARGIN
          : window.innerWidth - BTN_SIZE - EDGE_MARGIN;
      const next = clampPos(snappedX, p.y);
      try {
        localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) return;
    const id = setInterval(() => {
      setBubbleVisible(false);
      setTimeout(() => {
        setBubbleIdx((i) => (i + 1) % BUBBLE_MESSAGES.length);
        setBubbleVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(id);
  }, [open]);

  if (pathname !== "/" && pathname !== "/menu") return null;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

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
            <div className="bg-[#8B1A2C] text-white px-4 py-3 rounded-t-3xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <Image
                    src="/noroji.png"
                    alt="ノロジー"
                    width={40}
                    height={40}
                    className="w-full h-full object-contain drop-shadow mix-blend-multiply"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">ノロジーのおすすめ案内</p>
                  <p className="text-xs text-[#F5C0C8] leading-tight">ノロジーが在庫から厳選してご提案</p>
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
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Image
                        src="/noroji.png"
                        alt="ノロジー"
                        width={32}
                        height={32}
                        className="w-full h-full object-contain drop-shadow-sm mix-blend-multiply"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[#8B1A2C] text-white rounded-br-sm"
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
                    className="text-xs bg-[#f5f0eb] text-[#8B1A2C] px-3 py-1.5 rounded-full border border-[#e8e0d8] hover:bg-[#8B1A2C] hover:text-white transition-colors font-medium"
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
                className="flex-1 border border-[#e8e0d8] rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-[#fdf8f3] disabled:opacity-60"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-11 h-11 bg-[#8B1A2C] text-white rounded-2xl flex items-center justify-center hover:bg-[#2E5BA8] transition-colors disabled:opacity-40 flex-shrink-0"
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

      {/* Floating button + speech bubble (draggable, AssistiveTouch style) */}
      {!open && pos && (
        <div
          className="fixed z-[55]"
          style={{
            left: pos.x,
            top: pos.y,
            width: BTN_SIZE,
            height: BTN_SIZE,
            touchAction: "none",
            transition: dragging ? "none" : "left 0.25s ease, top 0.25s ease",
          }}
        >
          {/* Speech bubble */}
          <div
            className={`absolute bottom-full mb-2 transition-all duration-300 ${
              pos.x + BTN_SIZE / 2 < window.innerWidth / 2 ? "left-0" : "right-0"
            } ${
              bubbleVisible && !dragging
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1 pointer-events-none"
            }`}
          >
            <div className="relative bg-white rounded-2xl rounded-br-sm px-3 py-2 shadow-lg border border-[#e8e0d8] max-w-[180px] w-max">
              <p className="text-xs font-bold text-[#1a1a1a] leading-snug">
                {BUBBLE_MESSAGES[bubbleIdx]}
              </p>
              <p className="text-[10px] text-[#6b5e52] mt-0.5">ノロジーにきいてみよう！</p>
              <div className="absolute -bottom-[7px] right-5 w-0 h-0 border-l-[6px] border-l-transparent border-t-[7px] border-t-white" />
              <div className="absolute -bottom-[8px] right-[19px] w-0 h-0 border-l-[7px] border-l-transparent border-t-[8px] border-t-[#e8e0d8]" style={{ zIndex: -1 }} />
            </div>
          </div>

          {/* ノロジー button */}
          <button
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`w-16 h-16 flex items-center justify-center transition-transform active:scale-95 ${
              dragging ? "scale-110" : "hover:scale-110"
            }`}
            style={{ touchAction: "none" }}
            aria-label="ノロジーに相談する"
          >
            <div
              className={`transition-all duration-300 ${
                bubbleVisible ? "opacity-100 scale-100" : "opacity-80 scale-95"
              }`}
            >
              <Image
                src="/noroji.png"
                alt="ノロジー"
                width={64}
                height={64}
                draggable={false}
                className="object-contain drop-shadow-lg mix-blend-multiply"
              />
            </div>
          </button>
        </div>
      )}
    </>
  );
}
