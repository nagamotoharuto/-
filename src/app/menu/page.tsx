"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, ArrowRight } from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import ProductCard from "@/components/features/ProductCard";
import StepIndicator from "@/components/features/StepIndicator";
import { useBakeryStore } from "@/lib/store";
import { formatPrice } from "@/lib/utils";

const CATEGORIES = [
  { value: "all", label: "すべて" },
  { value: "bread", label: "パン" },
  { value: "drink", label: "ドリンク" },
  { value: "goods", label: "グッズ" },
];

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  stock: number;
  description: string;
  isAvailable: boolean;
}

export default function MenuPage() {
  const router = useRouter();
  const { user, getTotalItems, getTotal, cart } = useBakeryStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [user, router]);

  const filtered =
    category === "all" ? products : products.filter((p) => p.category === category);

  const totalItems = getTotalItems();
  const total = getTotal();

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-32">
      <Header />

      <div className="max-w-md mx-auto w-full px-4">
        <StepIndicator current={1} />

        {/* Category tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                category === c.value
                  ? "bg-[#1B3A6B] text-white"
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
      </div>

      {/* Cart CTA */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => router.push("/cart")}
              className="w-full bg-[#1B3A6B] text-white rounded-2xl py-4 flex items-center justify-between px-5 shadow-lg hover:bg-[#2E5BA8] transition-colors"
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
