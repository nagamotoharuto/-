"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  RefreshCw,
  BarChart2,
  AlertTriangle,
  Croissant,
  CupSoda,
  Shirt,
  PackageOpen,
  UserX,
  Undo2,
  BellRing,
  Sparkles,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  formatJstDateLabel,
  formatPrice,
  getReleaseDeadline,
  PAYMENT_LABELS,
  RELEASE_GRACE_MINUTES,
  toJstDateString,
} from "@/lib/utils";
import StaffHeader from "@/components/features/StaffHeader";

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

const CATEGORY_COLORS: Record<string, string> = {
  food: "bg-amber-100 text-amber-800",
  drink: "bg-blue-100 text-blue-800",
  goods: "bg-purple-100 text-purple-800",
  // 区分統合前の予約データ用
  bread: "bg-amber-100 text-amber-800",
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"orders" | "sales">("orders");
  const [salesRange, setSalesRange] = useState<"today" | "all">("today");
  const [releasing, setReleasing] = useState<string | null>(null);
  // 飛び込み客が売り切れで買えなかった件数。アプリからは観測できないので手入力。
  const [turnawayCount, setTurnawayCount] = useState<number | null>(null);
  const [turnawayBusy, setTurnawayBusy] = useState(false);
  // Re-renders the countdowns once a minute without refetching
  const [now, setNow] = useState(() => Date.now());
  // 新しく入った予約。スタッフが「確認しました」を押すまで強調し続ける。
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  // これまでに画面へ出た予約。初回読み込み分は既知として扱う。
  const seenOrderIds = useRef<Set<string>>(new Set());
  const hasLoadedOnce = useRef(false);

  /**
   * 取得した一覧を画面へ反映し、前回になかった予約を新着として拾い上げる。
   * 画面を開いた時点の予約は「もう見たもの」として扱う。
   */
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

  /** 操作のあとや手動更新で呼ぶ再取得。読み込み中の表示は出さない。 */
  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      applyOrders(Array.isArray(data) ? data : []);
    } catch {
      // 次の定期取得で追いつくので、ここでは何もしない
    } finally {
      setLoading(false);
    }
  }, [applyOrders]);

  const loadTurnaway = useCallback(() => {
    fetch("/api/turnaway")
      .then((r) => r.json())
      .then((data) => setTurnawayCount(data.count ?? 0))
      .catch(() => {});
  }, []);

  async function recordTurnaway(undo: boolean) {
    setTurnawayBusy(true);
    try {
      const res = await fetch("/api/turnaway", { method: undo ? "DELETE" : "POST" });
      const data = await res.json();
      if (res.ok) setTurnawayCount(data.count ?? 0);
    } finally {
      setTurnawayBusy(false);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
      return;
    }

    let cancelled = false;

    // 予約はお客様の端末から入ってくるので、この画面が自分で取りに行かないと
    // 気づけない。一覧は差し替えるだけなので表示はちらつかない。
    function pullOrders() {
      fetch("/api/orders")
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) applyOrders(Array.isArray(data) ? data : []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    pullOrders();
    loadTurnaway();

    const ordersId = setInterval(pullOrders, 15_000);

    // No-shows are swept server-side; the dashboard drives the sweep while it
    // is open, and placing an order triggers one too, so slots never stay stuck.
    const sweepId = setInterval(() => {
      fetch("/api/orders/release", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.released > 0) pullOrders();
        })
        .catch(() => {});
    }, 30_000);

    const clockId = setInterval(() => setNow(Date.now()), 30_000);


    return () => {
      cancelled = true;
      clearInterval(ordersId);
      clearInterval(sweepId);
      clearInterval(clockId);
    };
  }, [router, applyOrders, loadTurnaway]);

  // 予約に手をつけたら、その分の強調は役目を終える
  function acknowledgeOrder(orderId: string) {
    setNewOrderIds((prev) => prev.filter((id) => id !== orderId));
  }

  // Hand a single reservation back to the shelf without waiting for the sweep
  async function releaseOrder(orderId: string) {
    setReleasing(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "released" }),
      });
      acknowledgeOrder(orderId);
      await refreshOrders();
    } finally {
      setReleasing(null);
    }
  }

  async function updateStatus(orderId: string, status: string) {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    acknowledgeOrder(orderId);
    refreshOrders();
  }

  const filtered =
    filter === "all"
      ? orders
      : filter === "overdue"
      ? orders.filter(isOverdue)
      : orders.filter((o) => o.status === filter);

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const todayPending = orders.filter((o) => o.status === "pending").length;
  const todayReady = orders.filter((o) => o.status === "ready").length;

  // Sales are grouped by the day the items are handed over, not the day the
  // reservation was taken — a reservation made on the previous business day
  // belongs to the sale day it was placed for.
  function isForToday(order: Order) {
    return order.pickupDate === toJstDateString(new Date(now));
  }

  // Still awaiting collection: the only orders a release applies to
  function isAwaitingPickup(order: Order) {
    return order.status === "pending" || order.status === "ready";
  }

  // "受取未到達": past the promised pickup time but not yet released
  function isOverdue(order: Order) {
    if (!isAwaitingPickup(order) || !order.pickupDate) return false;
    const [h, m] = order.pickupTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return false;
    const pickupAt = new Date(`${order.pickupDate}T00:00:00+09:00`).getTime() + (h * 60 + m) * 60_000;
    return now > pickupAt;
  }

  // Minutes left before the grace period expires and the slot is auto-released.
  // Negative once the sweep is due (it runs on the next 30s tick).
  function minutesUntilRelease(order: Order): number | null {
    if (!isAwaitingPickup(order) || !order.pickupDate) return null;
    const deadline = getReleaseDeadline(order.pickupDate, order.pickupTime).getTime();
    return Math.ceil((deadline - now) / 60_000);
  }

  const overdueOrders = orders.filter(isOverdue);
  const todayOverdue = overdueOrders.length;
  const todayReleased = orders.filter(
    (o) => o.status === "released" && o.pickupDate === toJstDateString(new Date(now))
  ).length;

  // Sales summary calculations
  const rangedOrders = salesRange === "today" ? orders.filter(isForToday) : orders;
  // Cancelled and released reservations never reached the customer through the
  // app — released items went back to the shelf for walk-up sale.
  const soldOrders = rangedOrders.filter(
    (o) => o.status !== "cancelled" && o.status !== "released"
  );
  const completedOrders = rangedOrders.filter((o) => o.status === "completed");
  const totalSales = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrderCount = soldOrders.length;

  const itemSalesMap = new Map<string, { name: string; category: string; count: number }>();
  for (const order of soldOrders) {
    for (const item of order.items) {
      const key = item.name;
      const existing = itemSalesMap.get(key);
      if (existing) {
        existing.count += item.quantity;
      } else {
        itemSalesMap.set(key, {
          name: item.name,
          category: item.category,
          count: item.quantity,
        });
      }
    }
  }
  const itemSales = Array.from(itemSalesMap.values()).sort((a, b) => b.count - a.count);
  const maxCount = itemSales[0]?.count ?? 1;

  const categoryTotals = { food: 0, drink: 0, goods: 0 };
  for (const item of itemSales) {
    if (item.category in categoryTotals) {
      categoryTotals[item.category as keyof typeof categoryTotals] += item.count;
    }
  }

  const categoryRevenue = { food: 0, drink: 0, goods: 0 };
  for (const order of soldOrders) {
    for (const item of order.items) {
      const category = item.category;
      if (category in categoryRevenue) {
        categoryRevenue[category as keyof typeof categoryRevenue] += item.price * item.quantity;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      {/* Staff header */}
      <StaffHeader />

      {/* Tab switcher */}
      <div className="bg-white border-b border-[#e8e0d8] flex">
        <button
          onClick={() => setTab("orders")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold border-b-2 transition-colors ${
            tab === "orders" ? "border-[#8B1A2C] text-[#8B1A2C]" : "border-transparent text-[#6b5e52]"
          }`}
        >
          <ClipboardList size={15} />
          注文管理
        </button>
        <button
          onClick={() => setTab("sales")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold border-b-2 transition-colors ${
            tab === "sales" ? "border-[#8B1A2C] text-[#8B1A2C]" : "border-transparent text-[#6b5e52]"
          }`}
        >
          <BarChart2 size={15} />
          売上集計
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Date and refresh */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[#6b5e52]">{today}</p>
            <h1 className="font-black text-[#1a1a1a] text-lg">
              {tab === "orders" ? "注文管理" : "売上集計"}
            </h1>
          </div>
          <button
            onClick={() => refreshOrders()}
            className="flex items-center gap-1 text-xs text-[#6b5e52] bg-white rounded-lg px-3 py-2 border border-[#e8e0d8]"
          >
            <RefreshCw size={12} />
            更新
          </button>
        </div>

        {tab === "orders" ? (
          <>
            {/* 新着予約の呼び出し。カウンターに置いたiPadでも視界の端で気づけるよう、
                画面上部に貼り付けて明滅させる。 */}
            {newOrderIds.length > 0 && (
              <div className="sticky top-0 z-30 mb-4 animate-slide-down">
                <div className="flex items-center gap-3 rounded-2xl bg-[#F0AA5A] text-white px-4 py-3 shadow-lg animate-alert-breathe">
                  <BellRing size={22} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black leading-tight">
                      新しい予約が {newOrderIds.length} 件入りました
                    </p>
                    <p className="text-xs opacity-90 leading-tight mt-0.5">
                      下の一覧でオレンジ色に光っている予約です
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

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-yellow-700">{todayPending}</p>
                <p className="text-xs text-yellow-600">受付中</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-green-700">{todayReady}</p>
                <p className="text-xs text-green-600">準備完了</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-red-700">{todayOverdue}</p>
                <p className="text-xs text-red-600">受取未到達</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-orange-700">{todayReleased}</p>
                <p className="text-xs text-orange-600">本日解放</p>
              </div>
            </div>

            <p className="text-xs text-[#6b5e52] bg-white border border-[#e8e0d8] rounded-xl px-3 py-2 mb-4">
              受け取り時間から{RELEASE_GRACE_MINUTES}分を過ぎた未受取の予約は自動で解放され、店頭販売に戻ります。
              この画面を開いている間は自動で処理され、「今すぐ解放」で手動解放もできます。
            </p>

            {/* 売り切れ遭遇カウンタ：研究の「飛び込み客の売り切れ遭遇率」の元データ */}
            <div className="bg-white border border-[#e8e0d8] rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1a1a1a] flex items-center gap-1.5">
                    <UserX size={15} className="text-[#8B1A2C]" />
                    売り切れでお断りした人数
                  </p>
                  <p className="text-xs text-[#6b5e52] mt-0.5">
                    買いに来たが売り切れだったお客様がいたら押してください（本日分）
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-2xl font-black text-[#8B1A2C] w-10 text-right">
                    {turnawayCount ?? "—"}
                  </span>
                  <button
                    onClick={() => recordTurnaway(true)}
                    disabled={turnawayBusy || !turnawayCount}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#e8e0d8] text-[#6b5e52] hover:bg-[#f5f0eb] disabled:opacity-30 transition-colors"
                    aria-label="1件取り消す"
                  >
                    <Undo2 size={15} />
                  </button>
                  <button
                    onClick={() => recordTurnaway(false)}
                    disabled={turnawayBusy}
                    className="px-4 h-9 rounded-xl bg-[#8B1A2C] text-white text-sm font-bold hover:bg-[#A52235] disabled:opacity-50 transition-colors"
                  >
                    ＋1
                  </button>
                </div>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {[
                { value: "all", label: "すべて" },
                { value: "pending", label: "受付中" },
                { value: "ready", label: "準備完了" },
                { value: "overdue", label: "受取未到達" },
                { value: "released", label: "解放済" },
                { value: "completed", label: "受け渡し済" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    filter === f.value
                      ? "bg-[#8B1A2C] text-white"
                      : "bg-white text-[#6b5e52] border border-[#e8e0d8]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Orders list */}
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-[#e8e0d8]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-[#6b5e52]">
                <ClipboardList size={40} className="mx-auto mb-2 text-[#e8e0d8]" />
                <p>注文はありません</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((order) => {
                  const overdue = isOverdue(order);
                  const minsLeft = minutesUntilRelease(order);
                  const isNew = newOrderIds.includes(order.id);
                  return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                      isNew
                        ? "border-[#F0AA5A] ring-2 ring-[#F0AA5A] animate-ring-pulse"
                        : overdue
                        ? "border-red-300 ring-1 ring-red-200"
                        : "border-[#e8e0d8]"
                    }`}
                  >
                    <div className="px-4 pt-4 pb-3 border-b border-[#e8e0d8]">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-[#8B1A2C]">#{order.orderNumber}</span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}
                          >
                            {STATUS_LABELS[order.status]}
                          </span>
                          {isNew && (
                            <span className="flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full bg-[#F0AA5A] text-white animate-pop-in">
                              <Sparkles size={11} />
                              新着
                            </span>
                          )}
                          {overdue && (
                            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              <AlertTriangle size={11} />
                              受取未到達
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          {order.pickupDate && (
                            <p className="text-xs text-[#6b5e52] leading-tight">
                              {formatJstDateLabel(order.pickupDate, new Date(now))}
                            </p>
                          )}
                          <span className="text-lg font-black text-[#1a1a1a] leading-tight">
                            {order.pickupTime}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#6b5e52]">
                        <span className="font-bold text-[#1a1a1a]">{order.nickname}</span>
                        <span>|</span>
                        <span>{PAYMENT_LABELS[order.paymentMethod]}</span>
                        <span>|</span>
                        <span className="font-bold text-[#8B1A2C]">{formatPrice(order.totalAmount)}</span>
                      </div>
                      {order.email && (
                        <a
                          href={`mailto:${order.email}`}
                          className="text-xs text-[#8B1A2C] underline break-all"
                        >
                          {order.email}
                        </a>
                      )}
                    </div>
                    <div className="px-4 py-2 text-xs text-[#6b5e52]">
                      {order.items.map((item, i) => (
                        <span key={i}>
                          {item.name} ×{item.quantity}
                          {i < order.items.length - 1 ? "、" : ""}
                        </span>
                      ))}
                    </div>

                    {minsLeft !== null && (
                      <div className="px-4 pb-2">
                        {minsLeft > 0 ? (
                          <p className="text-xs text-[#6b5e52]">
                            自動解放まであと <strong className="text-[#1a1a1a]">{minsLeft}分</strong>
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-orange-700">
                            解放待ち（まもなく自動で店頭販売に戻ります）
                          </p>
                        )}
                      </div>
                    )}

                    {order.status === "released" && order.releasedAt && (
                      <div className="px-4 pb-2">
                        <p className="text-xs text-orange-700">
                          {new Date(order.releasedAt).toLocaleTimeString("ja-JP", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          に解放し、店頭販売に戻しました
                        </p>
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="px-4 pb-4 flex gap-2">
                      {order.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateStatus(order.id, "ready")}
                            className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-green-700 transition-colors"
                          >
                            準備完了
                          </button>
                          <button
                            onClick={() => updateStatus(order.id, "cancelled")}
                            className="px-4 bg-red-50 text-red-600 text-xs font-bold py-2 rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
                          >
                            キャンセル
                          </button>
                        </>
                      )}
                      {order.status === "ready" && (
                        <button
                          onClick={() => updateStatus(order.id, "completed")}
                          className="flex-1 bg-[#8B1A2C] text-white text-xs font-bold py-2 rounded-xl hover:bg-[#A52235] transition-colors"
                        >
                          受け渡し完了
                        </button>
                      )}
                      {isAwaitingPickup(order) && (
                        <button
                          onClick={() => releaseOrder(order.id)}
                          disabled={releasing === order.id}
                          className="flex items-center justify-center gap-1 px-4 bg-orange-50 text-orange-700 text-xs font-bold py-2 rounded-xl border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-50"
                        >
                          <PackageOpen size={13} />
                          {releasing === order.id ? "解放中..." : "今すぐ解放"}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Sales summary tab */
          <>
            {/* Range toggle */}
            <div className="flex gap-2 mb-4">
              {[
                { value: "today", label: "本日" },
                { value: "all", label: "全期間" },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => setSalesRange(r.value as "today" | "all")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                    salesRange === r.value
                      ? "bg-[#8B1A2C] text-white"
                      : "bg-white text-[#6b5e52] border border-[#e8e0d8]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Total sales card */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#8B1A2C] text-white rounded-2xl p-4 text-center">
                <p className="text-xs text-[#F5C0C8] mb-1">
                  {salesRange === "today" ? "本日の" : ""}受け渡し済売上
                </p>
                <p className="text-2xl font-black">{formatPrice(totalSales)}</p>
              </div>
              <div className="bg-white border border-[#e8e0d8] rounded-2xl p-4 text-center">
                <p className="text-xs text-[#6b5e52] mb-1">
                  {salesRange === "today" ? "本日の" : "合計"}注文件数
                </p>
                <p className="text-2xl font-black text-[#1a1a1a]">
                  {totalOrderCount}
                  <span className="text-sm font-normal text-[#6b5e52]">件</span>
                </p>
              </div>
            </div>

            {/* Category totals */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                <Croissant size={18} className="mx-auto mb-1 text-amber-700" />
                <p className="text-xl font-black text-amber-700">
                  {categoryTotals.food}
                  <span className="text-xs font-normal">個</span>
                </p>
                <p className="text-xs font-bold text-amber-700">{formatPrice(categoryRevenue.food)}</p>
                <p className="text-xs text-amber-600">パン・お菓子</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                <CupSoda size={18} className="mx-auto mb-1 text-blue-700" />
                <p className="text-xl font-black text-blue-700">
                  {categoryTotals.drink}
                  <span className="text-xs font-normal">個</span>
                </p>
                <p className="text-xs font-bold text-blue-700">{formatPrice(categoryRevenue.drink)}</p>
                <p className="text-xs text-blue-600">ドリンク</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center">
                <Shirt size={18} className="mx-auto mb-1 text-purple-700" />
                <p className="text-xl font-black text-purple-700">
                  {categoryTotals.goods}
                  <span className="text-xs font-normal">個</span>
                </p>
                <p className="text-xs font-bold text-purple-700">{formatPrice(categoryRevenue.goods)}</p>
                <p className="text-xs text-purple-600">大学グッズ</p>
              </div>
            </div>

            {/* Per-item sales */}
            <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4">
              <h2 className="font-bold text-[#1a1a1a] mb-3 flex items-center gap-2">
                <BarChart2 size={16} className="text-[#8B1A2C]" />
                商品別販売数
              </h2>
              {loading ? (
                <div className="flex flex-col gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-10 bg-[#f5f0eb] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : itemSales.length === 0 ? (
                <p className="text-center text-sm text-[#6b5e52] py-8">データがありません</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {itemSales.map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              CATEGORY_COLORS[item.category] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {CATEGORY_LABELS[item.category] ?? item.category}
                          </span>
                          <span className="text-sm font-bold text-[#1a1a1a]">{item.name}</span>
                        </div>
                        <span className="text-sm font-black text-[#8B1A2C]">{item.count}個</span>
                      </div>
                      <div className="w-full bg-[#f5f0eb] rounded-full h-2">
                        <div
                          className="bg-[#8B1A2C] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
