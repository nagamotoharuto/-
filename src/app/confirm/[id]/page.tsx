"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, MapPin, Clock, Receipt, Home, User } from "lucide-react";
import { useBakeryStore } from "@/lib/store";
import { formatPrice } from "@/lib/utils";
import BottomNav from "@/components/features/BottomNav";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: { name: string };
}

interface Order {
  id: string;
  orderNumber: string;
  nickname: string;
  userType: string;
  pickupTime: string;
  paymentMethod: string;
  status: string;
  totalAmount: number;
  items: OrderItem[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  paypay: "PayPay",
};

export default function ConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const clearCart = useBakeryStore((s) => s.clearCart);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data);
        clearCart();
      })
      .finally(() => setLoading(false));
  }, [params.id, clearCart]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf8f3] flex items-center justify-center">
        <div className="text-[#6b5e52]">読み込み中...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#fdf8f3] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[#6b5e52] mb-4">注文が見つかりませんでした</p>
          <button
            onClick={() => router.push("/")}
            className="bg-[#8B1A2C] text-white px-6 py-3 rounded-2xl font-bold"
          >
            ホームへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#8B1A2C] flex flex-col pb-20">
      {/* Starbucks-style confirmation header */}
      <div className="flex-shrink-0 px-4 pt-12 pb-8 text-center text-white">
        <CheckCircle size={56} className="mx-auto mb-4 text-[#c8843a]" strokeWidth={1.5} />
        <p className="text-sm text-[#ffc5ce] mb-1">注文を承りました</p>
        <h1 className="text-xl font-black mb-2">
          {order.nickname}さんのご来店を<br />お待ちしています
        </h1>
        <div className="inline-block bg-white/10 rounded-2xl px-6 py-3 mt-2">
          <p className="text-xs text-[#ffc5ce] mb-1">ニックネーム</p>
          <p className="text-3xl font-black tracking-wide">{order.nickname}</p>
        </div>
      </div>

      {/* Pickup time - big display */}
      <div className="mx-4 bg-white/10 rounded-2xl p-4 mb-3 text-white text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Clock size={16} className="text-[#c8843a]" />
          <span className="text-xs text-[#ffc5ce]">受け取り時間</span>
        </div>
        <p className="text-4xl font-black">{order.pickupTime}</p>
      </div>

      {/* Details card */}
      <div className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden flex-1">
        {/* Order number */}
        <div className="bg-[#f5f0eb] px-5 py-4 border-b border-[#e8e0d8]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-[#6b5e52]" />
              <span className="text-xs text-[#6b5e52] font-medium">注文番号</span>
            </div>
            <span className="text-2xl font-black text-[#8B1A2C]">#{order.orderNumber}</span>
          </div>
        </div>

        {/* Pickup location */}
        <div className="px-5 py-4 border-b border-[#e8e0d8]">
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-[#8B1A2C] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-[#6b5e52] font-medium mb-1">受け取り場所</p>
              <p className="text-sm font-bold text-[#1a1a1a]">1F 正面玄関前</p>
            </div>
          </div>
        </div>

        {/* How to pick up */}
        <div className="px-5 py-4 border-b border-[#e8e0d8]">
          <p className="text-xs font-bold text-[#6b5e52] mb-3">How to pick up</p>
          <ol className="space-y-2">
            {[
              "指定の時間に1F 正面玄関前にお越しください",
              "スタッフにニックネームをお伝えください",
              "商品をお受け取りの際にお支払いください",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#6b5e52]">
                <span className="w-4 h-4 bg-[#8B1A2C] text-white rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Order items */}
        <div className="px-5 py-4 border-b border-[#e8e0d8]">
          <p className="text-xs font-bold text-[#6b5e52] mb-3">注文内容</p>
          <div className="flex flex-col gap-1.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
                <span className="text-sm text-[#1a1a1a]">
                  {item.product.name} × {item.quantity}
                </span>
                <span className="text-sm font-medium text-[#1a1a1a]">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#e8e0d8] mt-3 pt-3 flex justify-between items-center">
            <span className="text-sm font-bold text-[#1a1a1a]">合計</span>
            <span className="text-lg font-black text-[#8B1A2C]">{formatPrice(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-[#6b5e52]">お支払い方法</span>
            <span className="text-xs font-medium text-[#6b5e52]">
              {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex-1 border-2 border-[#8B1A2C] text-[#8B1A2C] rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2"
          >
            <Home size={16} />
            ホームへ
          </button>
          <button
            onClick={() => router.push("/mypage")}
            className="flex-1 bg-[#8B1A2C] text-white rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2"
          >
            <User size={16} />
            スタンプ確認
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
