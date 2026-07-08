"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, RefreshCw, BarChart2, AlertTriangle, Croissant, CupSoda, Shirt } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import StaffHeader from "@/components/features/StaffHeader";

interface Order {
  id: string;
  orderNumber: string;
  nickname: string;
  userType: string;
  pickupTime: string;
  paymentMethod: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: Array<{ quantity: number; price: number; product: { name: string; category: string } }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "受付中",
  ready: "準備完了",
  completed: "受け渡し済",
  cancelled: "キャンセル",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  paypay: "PayPay",
};

const CATEGORY_LABELS: Record<string, string> = {
  bread: "パン",
  drink: "ドリンク",
  goods: "グッズ",
};

const CATEGORY_COLORS: Record<string, string> = {
  bread: "bg-amber-100 text-amber-800",
  drink: "bg-blue-100 text-blue-800",
  goods: "bg-purple-100 text-purple-800",
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"orders" | "sales">("orders");
  const [salesRange, setSalesRange] = useState<"today" | "all">("today");

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
      return;
    }
    loadOrders();
  }, [router]);

  async function loadOrders() {
    setLoading(true);
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function updateStatus(orderId: string, status: string) {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadOrders();
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

  function isToday(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  // "受取未到達": prepared and waiting, but past the promised pickup time
  function isOverdue(order: Order) {
    if (order.status !== "ready") return false;
    const [h, m] = order.pickupTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return false;
    const pickupAt = new Date(order.createdAt);
    pickupAt.setHours(h, m, 0, 0);
    return Date.now() > pickupAt.getTime();
  }

  const overdueOrders = orders.filter(isOverdue);
  const todayOverdue = overdueOrders.length;

  // Sales summary calculations
  const rangedOrders = salesRange === "today" ? orders.filter((o) => isToday(o.createdAt)) : orders;
  const soldOrders = rangedOrders.filter((o) => o.status !== "cancelled");
  const completedOrders = rangedOrders.filter((o) => o.status === "completed");
  const totalSales = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrderCount = soldOrders.length;

  const itemSalesMap = new Map<string, { name: string; category: string; count: number }>();
  for (const order of soldOrders) {
    for (const item of order.items) {
      const key = item.product.name;
      const existing = itemSalesMap.get(key);
      if (existing) {
        existing.count += item.quantity;
      } else {
        itemSalesMap.set(key, {
          name: item.product.name,
          category: item.product.category,
          count: item.quantity,
        });
      }
    }
  }
  const itemSales = Array.from(itemSalesMap.values()).sort((a, b) => b.count - a.count);
  const maxCount = itemSales[0]?.count ?? 1;

  const categoryTotals = { bread: 0, drink: 0, goods: 0 };
  for (const item of itemSales) {
    if (item.category in categoryTotals) {
      categoryTotals[item.category as keyof typeof categoryTotals] += item.count;
    }
  }

  const categoryRevenue = { bread: 0, drink: 0, goods: 0 };
  for (const order of soldOrders) {
    for (const item of order.items) {
      const category = item.product.category;
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
            onClick={loadOrders}
            className="flex items-center gap-1 text-xs text-[#6b5e52] bg-white rounded-lg px-3 py-2 border border-[#e8e0d8]"
          >
            <RefreshCw size={12} />
            更新
          </button>
        </div>

        {tab === "orders" ? (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
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
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {[
                { value: "all", label: "すべて" },
                { value: "pending", label: "受付中" },
                { value: "ready", label: "準備完了" },
                { value: "overdue", label: "受取未到達" },
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
                  return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                      overdue ? "border-red-300 ring-1 ring-red-200" : "border-[#e8e0d8]"
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
                          {overdue && (
                            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              <AlertTriangle size={11} />
                              受取未到達
                            </span>
                          )}
                        </div>
                        <span className="text-lg font-black text-[#1a1a1a]">{order.pickupTime}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#6b5e52]">
                        <span className="font-bold text-[#1a1a1a]">{order.nickname}</span>
                        <span>|</span>
                        <span>{PAYMENT_LABELS[order.paymentMethod]}</span>
                        <span>|</span>
                        <span className="font-bold text-[#8B1A2C]">{formatPrice(order.totalAmount)}</span>
                      </div>
                    </div>
                    <div className="px-4 py-2 text-xs text-[#6b5e52]">
                      {order.items.map((item, i) => (
                        <span key={i}>
                          {item.product.name} ×{item.quantity}
                          {i < order.items.length - 1 ? "、" : ""}
                        </span>
                      ))}
                    </div>
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
                  {categoryTotals.bread}
                  <span className="text-xs font-normal">個</span>
                </p>
                <p className="text-xs font-bold text-amber-700">{formatPrice(categoryRevenue.bread)}</p>
                <p className="text-xs text-amber-600">パン合計</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                <CupSoda size={18} className="mx-auto mb-1 text-blue-700" />
                <p className="text-xl font-black text-blue-700">
                  {categoryTotals.drink}
                  <span className="text-xs font-normal">個</span>
                </p>
                <p className="text-xs font-bold text-blue-700">{formatPrice(categoryRevenue.drink)}</p>
                <p className="text-xs text-blue-600">ドリンク合計</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center">
                <Shirt size={18} className="mx-auto mb-1 text-purple-700" />
                <p className="text-xl font-black text-purple-700">
                  {categoryTotals.goods}
                  <span className="text-xs font-normal">個</span>
                </p>
                <p className="text-xs font-bold text-purple-700">{formatPrice(categoryRevenue.goods)}</p>
                <p className="text-xs text-purple-600">大学グッズ合計</p>
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
