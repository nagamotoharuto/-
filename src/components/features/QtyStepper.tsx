"use client";

import { useCallback, useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// 押してから保存するまでの待ち時間。続けて押したぶんをまとめて1回で送る。
// 指で10回押すたびに10回保存しにいくと、iPadでは待たされる感じになる。
const COMMIT_DELAY_MS = 700;

interface Props {
  /** 未入力は null。閉店残数のように「まだ数えていない」状態があるため。 */
  value: number | null;
  /** 押した直後に呼ばれる。画面の数字をすぐ動かすために使う。 */
  onChange: (next: number) => void;
  /** 保存。続けて押している間は呼ばれず、手が止まってから1回だけ呼ばれる。 */
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  /** 未入力のときに数字の代わりに出す文字 */
  placeholder?: string;
  /** 読み上げ用の名前 */
  label: string;
  size?: "md" | "sm";
}

/**
 * 指で押して増やし減らしする数量の入力。
 *
 * iPadで数字を打ち込むのは、その都度キーボードが出てきて手間がかかる。
 * 発注数も閉店残数も1個ずつ動かすことがほとんどなので、押すだけで
 * 済むようにしている。まとめて変えたいときのために、真ん中の数字を
 * 押せば今までどおり打ち込める。
 */
export default function QtyStepper({
  value,
  onChange,
  onCommit,
  min = 0,
  max,
  placeholder = "—",
  label,
  size = "md",
}: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 押した値を保存予約する。続けて押されたら前の予約は捨てる。
  const scheduleCommit = useCallback(
    (next: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onCommit(next), COMMIT_DELAY_MS);
    },
    [onCommit]
  );

  // 画面から消えるときに予約が残っていたら、その場で保存してしまう。
  // 押したのに保存されないまま別の日に切り替わる、ということが起きないように。
  const pending = useRef<number | null>(null);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (pending.current !== null) commitRef.current(pending.current);
      }
    };
  }, []);

  function step(delta: number) {
    const base = value ?? 0;
    let next = base + delta;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    if (next === value) return;
    pending.current = next;
    onChange(next);
    scheduleCommit(next);
  }

  const atMin = (value ?? 0) <= min && value !== null;
  const atMax = max !== undefined && (value ?? 0) >= max;

  const btn = cn(
    "flex items-center justify-center rounded-xl border font-black select-none transition-colors",
    "bg-white border-[#e8e0d8] text-[#8B1A2C] active:bg-[#f5e9ec]",
    "disabled:opacity-30 disabled:active:bg-white",
    size === "md" ? "w-11 h-11" : "w-9 h-9"
  );

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={atMin}
        className={btn}
        aria-label={`${label}を1減らす`}
      >
        <Minus size={size === "md" ? 18 : 15} />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value === null ? "" : value}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return;
          let next = Math.max(min, parseInt(raw, 10) || 0);
          if (max !== undefined && next > max) next = max;
          pending.current = next;
          onChange(next);
        }}
        onBlur={(e) => {
          if (e.target.value === "") return;
          if (timer.current) clearTimeout(timer.current);
          let next = Math.max(min, parseInt(e.target.value, 10) || 0);
          if (max !== undefined && next > max) next = max;
          pending.current = null;
          onCommit(next);
        }}
        className={cn(
          "border border-[#e8e0d8] rounded-xl text-center font-black bg-[#fdf8f3]",
          "focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] tabular-nums",
          size === "md" ? "w-14 h-11 text-base" : "w-12 h-9 text-sm"
        )}
        aria-label={label}
      />

      <button
        type="button"
        onClick={() => step(1)}
        disabled={atMax}
        className={btn}
        aria-label={`${label}を1増やす`}
      >
        <Plus size={size === "md" ? 18 : 15} />
      </button>
    </div>
  );
}
