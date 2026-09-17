"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Minus,
  PackageOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Undo2,
  UserX,
} from "lucide-react";
import StaffHeader from "@/components/features/StaffHeader";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  cn,
  formatJstDateLabel,
  formatPrice,
  getNextBusinessDay,
  getReleaseDeadline,
  PAYMENT_LABELS,
  RELEASE_GRACE_MINUTES,
  toJstDateString,
} from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  nickname: string;
  email: string;
  userType: string;
  pickupDate: string;
  pickupTime: string;
  paymentMethod: string;
  status: string;
  releasedAt: string | null;
  totalAmount: number;
  createdAt: string;
  items: Array<{ quantity: number; price: number; name: string; category: string }>;
}

interface AvailabilityItem {
  id: string;
  name: string;
  category: string;
  price: number;
  plannedQty: number;
  reservableQty: number;
  reservedQty: number;
  unfulfilledQty: number;
  walkInSoldQty: number;
  remainingStock: number;
  remainingQty: number;
}

interface DayMetrics {
  reservedRevenue: number;
  walkInRevenue: number;
  totalRevenue: number;
  reservedSoldQty: number;
  walkInSoldQty: number;
  totalSoldQty: number;
  plannedQty: number;
  remainingStock: number;
  completedCount: number;
  releasedCount: number;
  releasedQty: number;
  capReachedCount: number;
  turnawayCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "受付中",
  ready: "準備完了",
  completed: "受け渡し済",
  cancelled: "キャンセル",
  released: "解放済（店頭へ）",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  released: "bg-orange-100 text-orange-800",
};

export default function TodayPage() {
  const router = useRouter();

  const today = toJstDateString();
  const nextDay = getNextBusinessDay();

  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<AvailabilityItem[]>([]);
  const [metrics, setMetrics] = useState<DayMetrics | null>(null);
  const [turnawayCount, setTurnawayCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [orderDate, setOrderDate] = useState(today);
  const [now, setNow] = useState(() => Date.now());

  // 新しく入った予約。スタッフが「確認しました」を押すまで強調し続ける。
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  const seenOrderIds = useRef<Set<string>>(new Set());
  const hasLoadedOnce = useRef(false);

  const applyOrders = useCallback((list: Order[]) => {
    if (!hasLoadedOnce.current) {
      for (const order of list) seenOrderIds.current.add(order.id);
      hasLoadedOnce.current = true;
    } else {
      const fresh = list.filter((o) => !seenOrderIds.current.has(o.id));
      for (const order of fresh) seenOrderIds.current.add(order.id);
      if (fresh.length > 0) {
        setNewOrderIds((prev) => [...new Set([...prev, ...fresh.map((o) => o.id)])]);
      }
    }
    setOrders(list);
  }, []);

  /** 画面の数字をまとめて取り直す。読み込み中の表示は出さないのでちらつかない。 */
  const refresh = useCallback(async () => {
    try {
      const [ordersRes, availRes, metricsRes, turnawayRes] = await Promise.all([
        fetch("/api/orders").then((r) => r.json()),
        fetch(`/api/daily-stock?date=${today}`).then((r) => r.json()),
        fetch(`/api/metrics?from=${today}&to=${today}`).then((r) => r.json()),
        fetch("/api/turnaway").then((r) => r.json()),
      ]);
      applyOrders(Array.isArray(ordersRes) ? ordersRes : []);
      setItems(Array.isArray(availRes.items) ? availRes.items : []);
      setMetrics(metricsRes.days?.[0] ?? null);
      setTurnawayCount(turnawayRes.count ?? 0);
    } catch {
      // 次の定期取得で追いつく
    } finally {
      setLoading(false);
    }
  }, [today, applyOrders]);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
      return;
    }

    let cancelled = false;

    function pull() {
      Promise.all([
        fetch("/api/orders").then((r) => r.json()),
        fetch(`/api/daily-stock?date=${today}`).then((r) => r.json()),
        fetch(`/api/metrics?from=${today}&to=${today}`).then((r) => r.json()),
        fetch("/api/turnaway").then((r) => r.json()),
      ])
        .then(([ordersRes, availRes, metricsRes, turnawayRes]) => {
          if (cancelled) return;
          applyOrders(Array.isArray(ordersRes) ? ordersRes : []);
          setItems(Array.isArray(availRes.items) ? availRes.items : []);
          setMetrics(metricsRes.days?.[0] ?? null);
          setTurnawayCount(turnawayRes.count ?? 0);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    pull();
    const pullId = setInterval(pull, 15_000);

    // 未受取の予約は画面を開いている間に自動で解放する
    const sweepId = setInterval(() => {
      fetch("/api/orders/release", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.released > 0) pull();
        })
        .catch(() => {});
    }, 30_000);

    const clockId = setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      cancelled = true;
      clearInterval(pullId);
      clearInterval(sweepId);
      clearInterval(clockId);
    };
  }, [router, today, applyOrders]);

  function acknowledgeOrder(orderId: string) {
    setNewOrderIds((prev) => prev.filter((id) => id !== orderId));
  }

  async function updateStatus(orderId: string, status: string) {
    setBusyId(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      acknowledgeOrder(orderId);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  /** 飛び込み販売。1回押すと売上金・販売数・残数・予約可能数がまとめて動く。 */
  async function recordWalkInSale(productId: string) {
    setBusyId(productId);
    setError("");
    try {
      const res = await fetch("/api/walk-in-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, date: today }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "記録に失敗しました");
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function undoWalkInSale(productId: string) {
    setBusyId(productId);
    try {
      await fetch(
        `/api/walk-in-sales?productId=${encodeURIComponent(productId)}&date=${today}`,
        { method: "DELETE" }
      );
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function recordTurnaway(undo: boolean) {
    setBusyId("turnaway");
    try {
      const res = await fetch("/api/turnaway", { method: undo ? "DELETE" : "POST" });
      const data = await res.json();
      if (res.ok) setTurnawayCount(data.count ?? 0);
    } finally {
      setBusyId(null);
    }
  }

  function isAwaitingPickup(order: Order) {
    return order.status === "pending" || order.status === "ready";
  }

  function minutesUntilRelease(order: Order): number | null {
    if (!isAwaitingPickup(order) || !order.pickupDate) return null;
    return Math.ceil((getReleaseDeadline(order.pickupDate, order.pickupTime).getTime() - now) / 60_000);
  }

  const dateOrders = orders.filter((o) => o.pickupDate === orderDate);
  const awaiting = dateOrders.filter(isAwaitingPickup);
  const done = dateOrders.filter((o) => !isAwaitingPickup(o));
  const offered = items.filter((i) => i.plannedQty > 0);

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-5">
        {/* ---------- 本日の数字 ---------- */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-black text-[#1a1a1a] text-lg">
              {formatJstDateLabel(today).replace("（本日）", "")} の売上
            </h1>
            <button
              onClick={() => refresh()}
              className="flex items-center gap-1 text-xs text-[#6b5e52] bg-white rounded-lg px-3 py-2 border border-[#e8e0d8]"
            >
              <RefreshCw size={12} />
              更新
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f5f0eb] text-[#6b5e52] text-xs">
                  <th className="text-left font-bold px-3 py-2"></th>
                  <th className="text-right font-bold px-3 py-2">予約</th>
                  <th className="text-right font-bold px-3 py-2">飛び込み</th>
                  <th className="text-right font-bold px-3 py-2">合計</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-t border-[#e8e0d8]">
                  <th className="text-left font-medium px-3 py-2.5 text-[#1a1a1a]">売上金</th>
                  <td className="text-right px-3 py-2.5">{formatPrice(metrics?.reservedRevenue ?? 0)}</td>
                  <td className="text-right px-3 py-2.5">{formatPrice(metrics?.walkInRevenue ?? 0)}</td>
                  <td className="text-right px-3 py-2.5 font-black text-[#8B1A2C]">
                    {formatPrice(metrics?.totalRevenue ?? 0)}
                  </td>
                </tr>
                <tr className="border-t border-[#e8e0d8]">
                  <th className="text-left font-medium px-3 py-2.5 text-[#1a1a1a]">販売個数</th>
                  <td className="text-right px-3 py-2.5">{metrics?.reservedSoldQty ?? 0}個</td>
                  <td className="text-right px-3 py-2.5">{metrics?.walkInSoldQty ?? 0}個</td>
                  <td className="text-right px-3 py-2.5 font-black text-[#8B1A2C]">
                    {metrics?.totalSoldQty ?? 0}個
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-[#e8e0d8] border-t border-[#e8e0d8]">
              {[
                { label: "発注数", value: `${metrics?.plannedQty ?? 0}` },
                { label: "残数", value: `${metrics?.remainingStock ?? 0}` },
                { label: "受け取り済", value: `${metrics?.completedCount ?? 0}件` },
                { label: "解放した数", value: `${metrics?.releasedQty ?? 0}` },
                { label: "上限到達", value: `${metrics?.capReachedCount ?? 0}` },
                { label: "売切で断り", value: `${turnawayCount ?? 0}人` },
              ].map((s) => (
                <div key={s.label} className="bg-white px-2 py-2.5 text-center">
                  <p className="text-lg font-black text-[#1a1a1a] tabular-nums leading-tight">
                    {s.value}
                  </p>
                  <p className="text-[10px] text-[#6b5e52] leading-tight mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 売り切れで断った人数 */}
          <div className="bg-white border border-[#e8e0d8] rounded-2xl p-3 mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1a1a1a] flex items-center gap-1.5">
                <UserX size={15} className="text-[#8B1A2C]" />
                売り切れでお断りした人数
              </p>
              <p className="text-xs text-[#6b5e52] mt-0.5">買えなかったお客様がいたら押してください</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => recordTurnaway(true)}
                disabled={busyId === "turnaway" || !turnawayCount}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#e8e0d8] text-[#6b5e52] hover:bg-[#f5f0eb] disabled:opacity-30 transition-colors"
                aria-label="1件取り消す"
              >
                <Undo2 size={15} />
              </button>
              <button
                onClick={() => recordTurnaway(false)}
                disabled={busyId === "turnaway"}
                className="px-5 h-9 rounded-xl bg-[#8B1A2C] text-white text-sm font-bold hover:bg-[#A52235] disabled:opacity-50 transition-colors"
              >
                ＋1
              </button>
            </div>
          </div>
        </section>

        {/* ---------- 飛び込み販売 ---------- */}
        <section>
          <h2 className="font-black text-[#1a1a1a] text-base mb-1">店頭で売れたら押す</h2>
          <p className="text-xs text-[#6b5e52] mb-2">
            1回押すと売上金・販売個数・残数・予約できる数がまとめて更新されます
          </p>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
              {error}
            </p>
          )}

          {loading ? (
            <div className="bg-white rounded-2xl h-40 animate-pulse border border-[#e8e0d8]" />
          ) : offered.length === 0 ? (
            <p className="text-center text-sm text-[#6b5e52] bg-white border border-[#e8e0d8] rounded-2xl py-8">
              本日の発注数が未入力です。「商品・発注」から入力してください
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {CATEGORIES.map((cat) => {
                const catItems = offered.filter((i) => i.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs font-bold text-[#8B1A2C] mb-1.5">{CATEGORY_LABELS[cat]}</p>
                    <div className="flex flex-col gap-2">
                      {catItems.map((item) => {
                        const soldOut = item.remainingStock === 0;
                        // 棚の残りが受け取り前の予約より少ない＝予約分を売ってしまう手前
                        const short = item.remainingStock < item.unfulfilledQty;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "bg-white rounded-xl border px-3 py-2.5 flex items-center gap-3",
                              short ? "border-red-300 bg-red-50/40" : "border-[#e8e0d8]"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#1a1a1a] truncate">{item.name}</p>
                              <p className="text-[11px] text-[#6b5e52] tabular-nums">
                                残り<strong className={cn("mx-0.5", soldOut && "text-red-600")}>
                                  {item.remainingStock}
                                </strong>
                                ／発注{item.plannedQty}・予約{item.reservedQty}（未受取{item.unfulfilledQty}）・
                                飛び込み{item.walkInSoldQty}
                              </p>
                              {short && (
                                <p className="text-[11px] font-bold text-red-700 mt-0.5">
                                  予約分が不足します。これ以上店頭で売らないでください
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => undoWalkInSale(item.id)}
                              disabled={busyId === item.id || item.walkInSoldQty === 0}
                              className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#e8e0d8] text-[#6b5e52] hover:bg-[#f5f0eb] disabled:opacity-30 transition-colors flex-shrink-0"
                              aria-label="1件取り消す"
                            >
                              <Plus size={15} />
                            </button>
                            <button
                              onClick={() => recordWalkInSale(item.id)}
                              disabled={busyId === item.id || soldOut}
                              className="flex items-center gap-1 h-9 px-4 rounded-xl bg-[#8B1A2C] text-white text-sm font-bold hover:bg-[#A52235] disabled:opacity-30 transition-colors flex-shrink-0"
                            >
                              <Minus size={15} />
                              {soldOut ? "売り切れ" : "売れた"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------- 予約管理 ---------- */}
        <section>
          <h2 className="font-black text-[#1a1a1a] text-base mb-2">予約</h2>

          {newOrderIds.length > 0 && (
            <div className="sticky top-[104px] z-30 mb-3 animate-slide-down">
              <div className="flex items-center gap-3 rounded-2xl bg-[#F0AA5A] text-white px-4 py-3 shadow-lg animate-alert-breathe">
                <BellRing size={22} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black leading-tight">
                    新しい予約が {newOrderIds.length} 件入りました
                  </p>
                  <p className="text-xs opacity-90 leading-tight mt-0.5">
                    下でオレンジ色に光っている予約です
                  </p>
                </div>
                <button
                  onClick={() => setNewOrderIds([])}
                  className="flex-shrink-0 bg-white text-[#8B1A2C] rounded-xl px-4 py-2 text-sm font-bold hover:bg-[#fdf8f3] transition-colors"
                >
                  確認しました
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            {[today, nextDay].map((d) => (
              <button
                key={d}
                onClick={() => setOrderDate(d)}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors",
                  orderDate === d
                    ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                    : "bg-white text-[#6b5e52] border-[#e8e0d8]"
                )}
              >
                {formatJstDateLabel(d)}
                <span className="ml-1 opacity-80">
                  {orders.filter((o) => o.pickupDate === d && o.status !== "cancelled").length}件
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl h-32 animate-pulse border border-[#e8e0d8]" />
          ) : dateOrders.length === 0 ? (
            <p className="text-center text-sm text-[#6b5e52] bg-white border border-[#e8e0d8] rounded-2xl py-8">
              この日の予約はまだありません
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...awaiting, ...done].map((order) => {
                const isNew = newOrderIds.includes(order.id);
                const minsLeft = minutesUntilRelease(order);
                const overdue = minsLeft !== null && minsLeft <= 0;
                return (
                  <div
                    key={order.id}
                    className={cn(
                      "bg-white rounded-2xl border shadow-sm px-4 py-3",
                      isNew
                        ? "border-[#F0AA5A] ring-2 ring-[#F0AA5A] animate-ring-pulse"
                        : overdue
                        ? "border-red-300 ring-1 ring-red-200"
                        : "border-[#e8e0d8]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-black text-[#8B1A2C]">#{order.orderNumber}</span>
                        <span className="font-bold text-[#1a1a1a]">{order.nickname}</span>
                        {isNew && (
                          <span className="flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full bg-[#F0AA5A] text-white animate-pop-in">
                            <Sparkles size={11} />
                            新着
                          </span>
                        )}
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <span className="text-lg font-black text-[#1a1a1a] tabular-nums flex-shrink-0">
                        {order.pickupTime}
                      </span>
                    </div>

                    <p className="text-xs text-[#6b5e52] mb-1">
                      {order.items.map((item, i) => (
                        <span key={i}>
                          {item.name} ×{item.quantity}
                          {i < order.items.length - 1 ? "、" : ""}
                        </span>
                      ))}
                      <span className="mx-1.5">|</span>
                      {PAYMENT_LABELS[order.paymentMethod]}
                      <span className="mx-1.5">|</span>
                      <strong className="text-[#8B1A2C]">{formatPrice(order.totalAmount)}</strong>
                    </p>

                    {minsLeft !== null && (
                      <p
                        className={cn(
                          "text-xs mb-2",
                          overdue ? "font-bold text-orange-700" : "text-[#6b5e52]"
                        )}
                      >
                        {overdue ? (
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle size={11} />
                            解放待ち（まもなく店頭販売に戻ります）
                          </span>
                        ) : (
                          <>自動解放まであと {minsLeft}分</>
                        )}
                      </p>
                    )}

                    {order.status === "released" && order.releasedAt && (
                      <p className="text-xs text-orange-700 mb-2">
                        {new Date(order.releasedAt).toLocaleTimeString("ja-JP", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        に解放し、店頭販売に戻しました
                      </p>
                    )}

                    {isAwaitingPickup(order) && (
                      <div className="flex gap-2">
                        {order.status === "pending" && (
                          <button
                            onClick={() => updateStatus(order.id, "ready")}
                            disabled={busyId === order.id}
                            className="flex-1 bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            準備できた
                          </button>
                        )}
                        <button
                          onClick={() => updateStatus(order.id, "completed")}
                          disabled={busyId === order.id}
                          className="flex-1 bg-[#8B1A2C] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#A52235] disabled:opacity-50 transition-colors"
                        >
                          渡した
                        </button>
                        <button
                          onClick={() => updateStatus(order.id, "released")}
                          disabled={busyId === order.id}
                          className="flex items-center justify-center gap-1 px-3 bg-orange-50 text-orange-700 text-xs font-bold py-2.5 rounded-xl border border-orange-200 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                        >
                          <PackageOpen size={13} />
                          解放
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-[#6b5e52] mt-3">
            受け取り時間から{RELEASE_GRACE_MINUTES}分を過ぎた予約は自動で解放され、店頭販売に戻ります。
          </p>
        </section>
      </div>
    </div>
  );
}
