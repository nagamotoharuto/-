"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Minus, Trash2, ArrowRight, ShoppingBag } from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import StepIndicator from "@/components/features/StepIndicator";
import { useBakeryStore } from "@/lib/store";
import { formatPrice } from "@/lib/utils";

export default function CartPage() {
  const router = useRouter();
  const { cart, updateQuantity, removeFromCart, getTotal, getTotalItems } = useBakeryStore();
  const total = getTotal();
  const totalItems = getTotalItems();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-20">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <ShoppingBag size={56} className="text-[#e8e0d8]" />
          <p className="text-[#6b5e52] font-medium">カートに商品がありません</p>
          <button
            onClick={() => router.push("/menu")}
            className="bg-[#1B3A6B] text-white px-8 py-3 rounded-2xl font-bold"
          >
            メニューへ
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-32">
      <Header />

      <div className="max-w-md mx-auto w-full px-4">
        <StepIndicator current={1} />

        <h2 className="text-lg font-bold mb-4 text-[#1a1a1a]">カート</h2>

        <div className="flex flex-col gap-3 mb-4">
          {cart.map((item) => (
            <div
              key={item.productId}
              className="bg-white rounded-2xl border border-[#e8e0d8] p-3 flex items-center gap-3 shadow-sm"
            >
              <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#f5f0eb]">
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1a1a1a] line-clamp-2">{item.name}</p>
                <p className="text-sm font-black text-[#1B3A6B]">{formatPrice(item.price)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-[#6b5e52] hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="w-7 h-7 border-2 border-[#1B3A6B] text-[#1B3A6B] rounded-full flex items-center justify-center hover:bg-[#1B3A6B] hover:text-white transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="w-7 h-7 bg-[#1B3A6B] text-white rounded-full flex items-center justify-center hover:bg-[#2E5BA8] transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] p-4 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-[#6b5e52]">小計 ({totalItems}点)</span>
            <span className="text-sm font-bold">{formatPrice(total)}</span>
          </div>
          <div className="border-t border-[#e8e0d8] my-2" />
          <div className="flex justify-between items-center">
            <span className="font-bold text-[#1a1a1a]">合計</span>
            <span className="text-xl font-black text-[#1B3A6B]">{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      {/* Next step CTA */}
      <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => router.push("/time")}
            className="w-full bg-[#F0AA5A] text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-base shadow-lg hover:bg-[#D48A30] transition-colors"
          >
            受け取り時間を選ぶ
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}