"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  Gift,
  Flame,
  ShoppingBag,
  Calendar,
  ChevronDown,
  ChevronUp,
  Mail,
  Award,
} from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import { useBakeryStore } from "@/lib/store";
import {
  APP_AUTHOR,
  BREAD_BONUS_THRESHOLD,
  STAMPS_PER_CARD,
  USER_TYPE_LABELS,
  formatJstDateLabel,
  formatPrice,
} from "@/lib/utils";

interface StampCardCompletion {
  id: string;
  cardNumber: number;
  completedAt: string;
}

interface StampCard {
  stamps: number;
  totalOrders: number;
  streak: number;
  lastOrderDate: string;
  completions: StampCardCompletion[];
}

interface OrderItem {
  quantity: number;
  price: number;
  name: string;
  imageUrl: string;
  category: string;
  subCategory: string;
}

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  pickupDate: string;
  pickupTime: string;
  status: string;
  totalAmount: number;
  items: OrderItem[];
}


const STATUS_LABELS: Record<string, string> = {
  pending: "受付中",
  ready: "準備完了",
  completed: "受け渡し済",
  cancelled: "キャンセル",
  released: "時間超過で取消",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  released: "bg-orange-100 text-orange-800",
};


export default function MyPage() {
  const router = useRouter();
  const { user } = useBakeryStore();
  const [card, setCard] = useState<StampCard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [cardsOpen, setCardsOpen] = useState(false);

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
  const completions = card?.completions ?? [];
  const progress = stamps / STAMPS_PER_CARD;
  const remaining = STAMPS_PER_CARD - stamps;


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

        {/* ためたカードへの導線。製作者に見せる記録なので、すぐ開けるようにする。 */}
        <button
          onClick={() => setCardsOpen((v) => !v)}
          className={`w-full rounded-2xl p-4 mb-4 flex items-center gap-3 shadow-sm border transition-colors ${
            completions.length > 0
              ? "bg-[#F0AA5A] text-white border-[#F0AA5A]"
              : "bg-white text-[#1a1a1a] border-[#e8e0d8]"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              completions.length > 0 ? "bg-white/20" : "bg-[#f5f0eb]"
            }`}
          >
            <Award size={20} className={completions.length > 0 ? "" : "text-[#8B1A2C]"} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black text-sm">ためたカード {completions.length}枚</p>
            <p className={`text-xs ${completions.length > 0 ? "opacity-90" : "text-[#6b5e52]"}`}>
              {completions.length > 0
                ? "製作者にお見せください。タップで一覧"
                : "満了したカードはここに保存されます"}
            </p>
          </div>
          {cardsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {cardsOpen && (
          <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
            <h2 className="font-bold text-[#1a1a1a] mb-3 flex items-center gap-2">
              <Award size={16} className="text-[#8B1A2C]" />
              ためたスタンプカード
            </h2>
            {completions.length === 0 ? (
              <p className="text-xs text-center text-[#6b5e52] py-6">
                まだありません。{STAMPS_PER_CARD}個たまると1枚保存されます
              </p>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {completions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 border border-[#e8e0d8] rounded-xl px-3 py-2.5"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#8B1A2C] text-white flex items-center justify-center flex-shrink-0">
                      <Star size={15} className="fill-[#F0AA5A] text-[#F0AA5A]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#1a1a1a]">{c.cardNumber}枚目</p>
                      <p className="text-xs text-[#6b5e52]">
                        {new Date(c.completedAt).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                        に達成
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#fdf8f3] border border-[#e8e0d8] rounded-xl p-3">
              <p className="text-xs font-bold text-[#1a1a1a] mb-1.5 flex items-center gap-1.5">
                <Mail size={13} className="text-[#8B1A2C]" />
                特典の受け取りについて
              </p>
              <p className="text-xs text-[#6b5e52] leading-relaxed">
                カードがたまったら、この画面をお見せのうえ下記までご連絡ください。
              </p>
              <p className="text-xs text-[#1a1a1a] font-bold mt-1.5">{APP_AUTHOR.name}</p>
              <a
                href={`mailto:${APP_AUTHOR.email}`}
                className="text-xs text-[#8B1A2C] underline break-all"
              >
                {APP_AUTHOR.email}
              </a>
              <p className="text-xs text-[#6b5e52] mt-1">{APP_AUTHOR.note}</p>
            </div>
          </div>
        )}

        {/* Stamp card */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#1a1a1a]">スタンプカード</h2>
            <span className="text-xs text-[#6b5e52] bg-[#f5f0eb] px-2 py-1 rounded-full">
              {STAMPS_PER_CARD}個で特典
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
                {stamps === 0
                  ? completions.length > 0
                    ? "新しいカードです。注文するとスタンプが貯まります"
                    : "注文するとスタンプが貯まります"
                  : `あと${remaining}個で1枚達成`}
              </p>
            </>
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
                    const date = order.pickupDate
                      ? formatJstDateLabel(order.pickupDate).replace(/（.*?）$/, "")
                      : new Date(order.createdAt).toLocaleDateString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                        });
                    const time =
                      order.pickupTime ||
                      new Date(order.createdAt).toLocaleTimeString("ja-JP", {
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
                              {item.name} ×{item.quantity}
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

        {/* Rules */}
        <div className="bg-[#f5f0eb] rounded-2xl p-4 text-xs text-[#6b5e52]">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} />
            <span className="font-bold">スタンプ獲得ルール</span>
          </div>
          <ul className="space-y-1 pl-4 list-disc">
            <li>1日1回のご注文で1スタンプ（商品は何でも構いません）</li>
            <li>パンを{BREAD_BONUS_THRESHOLD}個以上ご購入でさらに+1スタンプ</li>
            <li>{STAMPS_PER_CARD}スタンプで1枚達成。新しいカードが自動で始まります</li>
            <li>達成したカードは「ためたカード」に保存されます</li>
            <li>特典のお渡しは製作者が個別に対応します。上の連絡先までお知らせください</li>
          </ul>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
