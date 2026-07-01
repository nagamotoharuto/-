"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Gift, Flame, ShoppingBag, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import { useBakeryStore } from "@/lib/store";
import { STAMPS_PER_CARD, USER_TYPE_LABELS, formatPrice } from "@/lib/utils";

interface StampCard {
  stamps: number;
  totalOrders: number;
  streak: number;
  lastOrderDate: string;
  freeItemAvailable: boolean;
}

interface OrderItem {
  quantity: number;
  price: number;
  product: { name: string; category: string };
}

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  totalAmount: number;
  items: OrderItem[];
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

export default function MyPage() {
  const router = useRouter();
  const { user } = useBakeryStore();
  const [card, setCard] = useState<StampCard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetch(`/api/stamp?nickname=${encodeURIComponent(user.nickname)}`)
      .then((r) => r.json())
      .then(setCard)
      .finally(() => setLoading(false));

    fetch(`/api/orders?nickname=${encodeURIComponent(user.nickname)}`)
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .finally(() => setOrdersLoading(false));
  }, [user, router]);

  if (!user) return null;

  const stamps = card?.stamps ?? 0;
  const streak = card?.streak ?? 0;
  const totalOrders = card?.totalOrders ?? 0;
  const freeItemAvailable = card?.freeItemAvailable ?? false;
  const progress = stamps / STAMPS_PER_CARD;
  const remaining = STAMPS_PER_CARD - stamps;

  // Aggregate bread items eaten
  const breadMap = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const item of order.items) {
      if (item.product.category === "bread") {
        breadMap.set(item.product.name, (breadMap.get(item.product.name) ?? 0) + item.quantity);
      }
    }
  }
  const breadStats = Array.from(breadMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-20">
      <Header />

      <div className="max-w-md mx-auto w-full px-4 py-4">
        {/* Profile */}
        <div className="bg-[#8B1A2C] text-white rounded-2xl p-5 mb-4 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#F0AA5A] rounded-full flex items-center justify-center text-xl font-black">
              {user.nickname.charAt(0)}
            </div>
            <div>
              <p className="font-black text-lg">{user.nickname}</p>
              <p className="text-xs text-[#F5C0C8]">
                {USER_TYPE_LABELS[user.userType] ?? user.userType}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: ShoppingBag, label: "合計注文", value: totalOrders, unit: "回" },
              { icon: Flame, label: "連続日数", value: streak, unit: "日" },
              { icon: Star, label: "スタンプ", value: stamps, unit: `/${STAMPS_PER_CARD}` },
            ].map(({ icon: Icon, label, value, unit }) => (
              <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
                <Icon size={16} className="mx-auto mb-1 text-[#F0AA5A]" />
                <p className="text-xs text-[#F5C0C8]">{label}</p>
                <p className="font-black text-lg">
                  {value}
                  <span className="text-xs font-normal text-[#F5C0C8]">{unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Free item banner */}
        {freeItemAvailable && (
          <div className="bg-[#F0AA5A] text-white rounded-2xl p-4 mb-4 flex items-center gap-3 shadow-md">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Gift size={20} />
            </div>
            <div>
              <p className="font-black text-sm">パン1個無料！</p>
              <p className="text-xs opacity-90">次回ご注文時にパン1品が自動で割引されます</p>
            </div>
          </div>
        )}

        {/* Stamp card */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#1a1a1a]">スタンプカード</h2>
            <span className="text-xs text-[#6b5e52] bg-[#f5f0eb] px-2 py-1 rounded-full">
              {STAMPS_PER_CARD}個でパン1品無料
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-5 gap-2">
              {[...Array(STAMPS_PER_CARD)].map((_, i) => (
                <div key={i} className="aspect-square rounded-full bg-[#f5f0eb] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[...Array(STAMPS_PER_CARD)].map((_, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-full flex items-center justify-center transition-all ${
                      i < stamps
                        ? "bg-[#8B1A2C] shadow-sm"
                        : "bg-[#f5f0eb] border-2 border-dashed border-[#e8e0d8]"
                    }`}
                  >
                    {i < stamps && <Star size={14} className="text-[#F0AA5A] fill-[#F0AA5A]" />}
                    {i === STAMPS_PER_CARD - 1 && i >= stamps && (
                      <Gift size={14} className="text-[#e8e0d8]" />
                    )}
                  </div>
                ))}
              </div>
              <div className="w-full bg-[#f5f0eb] rounded-full h-2 mb-2">
                <div
                  className="bg-[#8B1A2C] h-2 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(progress * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-center text-[#6b5e52]">
                {freeItemAvailable
                  ? "おめでとうございます！次の注文でパン1品無料！"
                  : stamps === 0
                  ? "注文するとスタンプが貯まります"
                  : `あと${remaining}個でパン1品無料`}
              </p>
            </>
          )}
        </div>

        {/* Bread history */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#1a1a1a] flex items-center gap-2">
              🍞 食べたパン
            </h2>
            {breadStats.length > 0 && (
              <span className="text-xs text-[#6b5e52] bg-[#f5f0eb] px-2 py-1 rounded-full">
                {breadStats.reduce((s, b) => s + b.count, 0)}個
              </span>
            )}
          </div>
          {ordersLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-[#f5f0eb] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : breadStats.length === 0 ? (
            <p className="text-xs text-center text-[#6b5e52] py-4">
              まだパンを注文したことがありません
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {breadStats.map((b, i) => (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-[#6b5e52] text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-bold text-[#1a1a1a]">{b.name}</span>
                  <div className="flex items-center gap-1">
                    {[...Array(Math.min(b.count, 5))].map((_, j) => (
                      <span key={j} className="text-base">🍞</span>
                    ))}
                    {b.count > 5 && (
                      <span className="text-xs text-[#6b5e52]">+{b.count - 5}</span>
                    )}
                  </div>
                  <span className="text-sm font-black text-[#8B1A2C] flex-shrink-0">{b.count}個</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order history */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <h2 className="font-bold text-[#1a1a1a] flex items-center gap-2">
              <Calendar size={16} className="text-[#8B1A2C]" />
              注文履歴
            </h2>
            <div className="flex items-center gap-2">
              {orders.length > 0 && (
                <span className="text-xs text-[#6b5e52] bg-[#f5f0eb] px-2 py-1 rounded-full">
                  {orders.length}件
                </span>
              )}
              {historyOpen ? (
                <ChevronUp size={16} className="text-[#6b5e52]" />
              ) : (
                <ChevronDown size={16} className="text-[#6b5e52]" />
              )}
            </div>
          </button>

          {historyOpen && (
            <div className="mt-3">
              {ordersLoading ? (
                <div className="flex flex-col gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-[#f5f0eb] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <p className="text-xs text-center text-[#6b5e52] py-4">
                  注文履歴はありません
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {orders.map((order) => {
                    const date = new Date(order.createdAt).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                    });
                    const time = new Date(order.createdAt).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <div
                        key={order.id}
                        className="border border-[#e8e0d8] rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#8B1A2C]">#{order.orderNumber}</span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {STATUS_LABELS[order.status] ?? order.status}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[#6b5e52]">{date} {time}</p>
                            <p className="text-sm font-black text-[#1a1a1a]">{formatPrice(order.totalAmount)}</p>
                          </div>
                        </div>
                        <p className="text-xs text-[#6b5e52]">
                          {order.items.map((item, i) => (
                            <span key={i}>
                              {item.product.name} ×{item.quantity}
                              {i < order.items.length - 1 ? "、" : ""}
                            </span>
                          ))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Streak card */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={20} className="text-orange-500" />
            <h2 className="font-bold text-[#1a1a1a]">連続注文チャレンジ</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[1, 3, 7, 14, 30].map((milestone) => (
              <div
                key={milestone}
                className={`flex-shrink-0 rounded-xl p-3 text-center w-16 ${
                  streak >= milestone ? "bg-[#8B1A2C] text-white" : "bg-[#f5f0eb] text-[#6b5e52]"
                }`}
              >
                <Flame
                  size={16}
                  className={`mx-auto mb-1 ${streak >= milestone ? "text-[#F0AA5A] fill-[#F0AA5A]" : "text-[#e8e0d8]"}`}
                />
                <p className="text-xs font-bold">{milestone}日</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#6b5e52] mt-3">
            {streak === 0 ? "毎日注文して連続記録を作ろう！" : `現在${streak}日連続！継続中`}
          </p>
        </div>

        {/* Rules */}
        <div className="bg-[#f5f0eb] rounded-2xl p-4 text-xs text-[#6b5e52]">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} />
            <span className="font-bold">スタンプ獲得ルール</span>
          </div>
          <ul className="space-y-1 pl-4 list-disc">
            <li>1日1スタンプ獲得（翌日以降の注文で加算）</li>
            <li>パン3個以上 または 大学グッズ1個以上でボーナス+1スタンプ</li>
            <li>{STAMPS_PER_CARD}スタンプ達成でパン1品無料（次回注文時に自動適用）</li>
            <li>スタンプは達成後にリセットされます</li>
          </ul>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
