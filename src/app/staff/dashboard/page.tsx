"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, ClipboardList, LogOut, ChefHat, RefreshCw, Home } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  nickname: string;
  userType: string;
  pickupTime: string;
  paymentMethod: string;
  status: string;
  totalAmount: number;
  items: Array<{ quantity: number; product: { name: string } }>;
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

export default function StaffDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/staff");
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

  function logout() {
    sessionStorage.removeItem("staff_auth");
    router.push("/staff");
  }

  const filtered =
    filter === "all"
      ? orders
      : orders.filter((o) => o.status === filter);

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const todayPending = orders.filter((o) => o.status === "pending").length;
  const todayReady = orders.filter((o) => o.status === "ready").length;

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      {/* Staff header */}
      <header className="bg-[#1B3A6B] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={20} className="text-[#F0AA5A]" />
          <span className="font-bold text-sm">スタッフ管理画面</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/staff/inventory" className="text-xs text-[#A8C8F0] hover:text-white flex items-center gap-1">
            <Package size={14} />
            在庫
          </Link>
          <Link href="/" className="text-xs text-[#A8C8F0] hover:text-white flex items-center gap-1">
            <Home size={14} />
            ホーム
          </Link>
          <button onClick={logout} className="text-xs text-[#A8C8F0] hover:text-white flex items-center gap-1">
            <LogOut size={14} />
            ログアウト
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Date and summary */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[#6b5e52]">{today}</p>
            <h1 className="font-black text-[#1a1a1a] text-lg">注文管理</h1>
          </div>
          <button onClick={loadOrders} className="flex items-center gap-1 text-xs text-[#6b5e52] bg-white rounded-lg px-3 py-2 border border-[#e8e0d8]">
            <RefreshCw size={12} />
            更新
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-yellow-700">{todayPending}</p>
            <p className="text-xs text-yellow-600">受付中</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-green-700">{todayReady}</p>
            <p className="text-xs text-green-600">準備完了</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { value: "all", label: "すべて" },
            { value: "pending", label: "受付中" },
            { value: "ready", label: "準備完了" },
            { value: "completed", label: "受け渡し済" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filter === f.value
                  ? "bg-[#1B3A6B] text-white"
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
            {filtered.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden"
              >
                <div className="px-4 pt-4 pb-3 border-b border-[#e8e0d8]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-[#1B3A6B]">#{order.orderNumber}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <span className="text-lg font-black text-[#1a1a1a]">{order.pickupTime}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#6b5e52]">
                    <span className="font-bold text-[#1a1a1a]">{order.nickname}</span>
                    <span>|</span>
                    <span>{PAYMENT_LABELS[order.paymentMethod]}</span>
                    <span>|</span>
                    <span className="font-bold text-[#1B3A6B]">{formatPrice(order.totalAmount)}</span>
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
                      className="flex-1 bg-[#1B3A6B] text-white text-xs font-bold py-2 rounded-xl hover:bg-[#2E5BA8] transition-colors"
                    >
                      受け渡し完了
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}