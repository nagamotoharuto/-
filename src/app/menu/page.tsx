"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, ArrowRight, CalendarDays } from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import ProductCard from "@/components/features/ProductCard";
import StepIndicator from "@/components/features/StepIndicator";
import { useBakeryStore } from "@/lib/store";
import {
  formatJstDateLabel,
  formatPrice,
  getReservableDate,
  RESERVATION_RATIO,
} from "@/lib/utils";

const CATEGORIES = [
  { value: "all", label: "すべて" },
  { value: "bread", label: "パン" },
  { value: "drink", label: "ドリンク" },
  { value: "goods", label: "グッズ" },
];

// Mirrors ProductAvailability from @/lib/availability
interface AvailabilityItem {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  description: string;
  isAvailable: boolean;
  isOffered: boolean;
  plannedQty: number;
  reservableQty: number;
  reservedQty: number;
  remainingQty: number;
}

export default function MenuPage() {
  const router = useRouter();
  const { user, pickupDate, pickupTime, getTotalItems, getTotal } = useBakeryStore();
  const [products, setProducts] = useState<AvailabilityItem[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The date drives which day's quota we are booking against, so it has to be
    // chosen (step 1) before the menu can show anything meaningful.
    if (!user) {
      router.push("/");
      return;
    }
    if (!pickupDate || !pickupTime) {
      router.push("/time");
      return;
    }

    function loadAvailability() {
      return fetch(`/api/availability?date=${encodeURIComponent(pickupDate)}`)
        .then((r) => r.json())
        .then((data) => setProducts(Array.isArray(data.items) ? data.items : []));
    }

    loadAvailability().finally(() => setLoading(false));

    // Poll so another customer's booking (or a released no-show) shows up
    // without a manual refresh, and send the customer back to step 1 once the
    // sale date they picked stops taking reservations.
    const id = setInterval(() => {
      if (getReservableDate() !== pickupDate) {
        router.push("/time");
        return;
      }
      loadAvailability();
    }, 5000);
    return () => clearInterval(id);
  }, [user, pickupDate, pickupTime, router]);

  if (!user || !pickupDate) return null;

  // Products with nothing produced for this date are not on the day's menu
  const offered = products.filter((p) => p.isOffered);
  const filtered =
    category === "all" ? offered : offered.filter((p) => p.category === category);

  const totalItems = getTotalItems();
  const total = getTotal();

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-32">
      <Header />

      <div className="max-w-md mx-auto w-full px-4">
        <StepIndicator current={2} />

        {/* Selected pickup slot — availability below is for this date only */}
        <button
          onClick={() => router.push("/time")}
          className="w-full bg-white rounded-2xl border border-[#e8e0d8] shadow-sm px-4 py-3 mb-4 flex items-center gap-3 text-left hover:border-[#8B1A2C] transition-colors"
        >
          <CalendarDays size={18} className="text-[#8B1A2C] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-[#6b5e52]">受け取り日時</p>
            <p className="text-sm font-bold text-[#1a1a1a]">
              {formatJstDateLabel(pickupDate)} {pickupTime}
            </p>
          </div>
          <span className="text-xs font-bold text-[#8B1A2C]">変更</span>
        </button>

        <p className="text-xs text-[#6b5e52] mb-4">
          表示しているのは予約できる残り数です。飛び込みのお客様用に、各商品の
          {Math.round((1 - RESERVATION_RATIO) * 100)}%は店頭に確保しています。
        </p>

        {/* Category tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                category === c.value
                  ? "bg-[#8B1A2C] text-white"
                  : "bg-white text-[#6b5e52] border border-[#e8e0d8]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-52 animate-pulse border border-[#e8e0d8]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-center text-sm text-[#6b5e52] py-12">
            この日に販売する商品はまだ登録されていません
          </p>
        )}
      </div>

      {/* Cart CTA */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => router.push("/cart")}
              className="w-full bg-[#8B1A2C] text-white rounded-2xl py-4 flex items-center justify-between px-5 shadow-lg hover:bg-[#A52235] transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} />
                <span className="text-sm font-bold">{totalItems}点</span>
              </div>
              <span className="text-sm font-bold">カートを見る</span>
              <div className="flex items-center gap-1">
                <span className="font-black">{formatPrice(total)}</span>
                <ArrowRight size={16} />
              </div>
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
