"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, SmartphoneNfc, ArrowRight, Gift } from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import StepIndicator from "@/components/features/StepIndicator";
import { useBakeryStore } from "@/lib/store";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { id: "cash", label: "現金", description: "お受け取り時にお支払い", icon: Wallet },
  { id: "paypay", label: "PayPay", description: "QRコードでお支払い", icon: SmartphoneNfc },
];

const BREAD_KEYWORDS = ["パン", "ロール", "クリーム", "カレー"];

export default function PaymentPage() {
  const router = useRouter();
  const { paymentMethod, setPaymentMethod, getTotal, cart, user, pickupTime } = useBakeryStore();
  const [selected, setSelected] = useState(paymentMethod || "cash");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [freeItemAvailable, setFreeItemAvailable] = useState(false);

  useEffect(() => {
    if (!user?.nickname) return;
    fetch(`/api/stamp?nickname=${encodeURIComponent(user.nickname)}`)
      .then((r) => r.json())
      .then((data) => setFreeItemAvailable(data.freeItemAvailable ?? false))
      .catch(() => {});
  }, [user]);

  // Detect cheapest bread-like item in cart for display purposes
  const breadItems = cart
    .filter((item) => BREAD_KEYWORDS.some((kw) => item.name.includes(kw)))
    .sort((a, b) => a.price - b.price);

  const freeBreadDiscount = freeItemAvailable && breadItems.length > 0 ? breadItems[0].price : 0;
  const baseTotal = getTotal();
  const displayTotal = Math.max(0, baseTotal - freeBreadDiscount);

  async function handleOrder() {
    if (!user || !pickupTime || cart.length === 0) {
      router.push("/");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setPaymentMethod(selected);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: user.nickname,
          userType: user.userType,
          pickupTime,
          paymentMethod: selected,
          items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "注文に失敗しました");
        return;
      }
      router.push(`/confirm/${data.id}`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-32">
      <Header />

      <div className="max-w-md mx-auto w-full px-4">
        <StepIndicator current={3} />

        <h2 className="text-lg font-bold mb-4 text-[#1a1a1a]">お支払い方法</h2>

        <div className="flex flex-col gap-3 mb-6">
          {PAYMENT_METHODS.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={cn(
                "bg-white rounded-2xl border-2 p-4 flex items-center gap-4 text-left transition-colors",
                selected === id ? "border-[#1B3A6B]" : "border-[#e8e0d8]"
              )}
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                  selected === id ? "bg-[#1B3A6B]" : "bg-[#f5f0eb]"
                )}
              >
                <Icon size={22} className={selected === id ? "text-white" : "text-[#6b5e52]"} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#1a1a1a]">{label}</p>
                <p className="text-xs text-[#6b5e52]">{description}</p>
              </div>
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  selected === id ? "border-[#1B3A6B] bg-[#1B3A6B]" : "border-[#e8e0d8]"
                )}
              >
                {selected === id && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </button>
          ))}
        </div>

        {/* Free bread banner */}
        {freeItemAvailable && breadItems.length > 0 && (
          <div className="bg-[#F0AA5A] text-white rounded-2xl p-3 mb-4 flex items-center gap-3">
            <Gift size={20} className="flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">パン1品無料が適用されます！</p>
              <p className="text-xs opacity-90">
                「{breadItems[0].name}」が {formatPrice(freeBreadDiscount)} 引きになります
              </p>
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-4">
          <h3 className="text-sm font-bold text-[#1a1a1a] mb-3">注文内容</h3>
          <div className="flex flex-col gap-2 mb-3">
            {cart.map((item) => (
              <div key={item.productId} className="flex justify-between items-center">
                <span className="text-sm text-[#6b5e52]">
                  {item.name} × {item.quantity}
                </span>
                <span className="text-sm font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
            {freeBreadDiscount > 0 && (
              <div className="flex justify-between items-center text-[#F0AA5A]">
                <span className="text-sm font-bold">パン1品無料割引</span>
                <span className="text-sm font-bold">-{formatPrice(freeBreadDiscount)}</span>
              </div>
            )}
          </div>
          <div className="border-t border-[#e8e0d8] pt-3 flex justify-between items-center">
            <span className="font-bold">合計</span>
            <span className="text-xl font-black text-[#1B3A6B]">{formatPrice(displayTotal)}</span>
          </div>
          {pickupTime && (
            <div className="mt-2 text-xs text-[#6b5e52] flex justify-between">
              <span>受け取り時間</span>
              <span className="font-bold">{pickupTime}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleOrder}
            disabled={loading}
            className="w-full bg-[#F0AA5A] text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-base shadow-lg hover:bg-[#D48A30] transition-colors disabled:opacity-60"
          >
            {loading ? "注文中..." : "注文を確定する"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}