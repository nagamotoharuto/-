"use client";

import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { useBakeryStore } from "@/lib/store";
import { formatPrice } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  description: string;
  isAvailable: boolean;
}

export default function ProductCard({ product }: { product: Product }) {
  const { cart, addToCart, updateQuantity } = useBakeryStore();
  const cartItem = cart.find((c) => c.productId === product.id);
  const qty = cartItem?.quantity ?? 0;
  const soldOut = !product.isAvailable || product.stock === 0;

  function handleAdd() {
    if (soldOut) return;
    if (qty >= product.stock) return;
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      category: "",
    });
  }

  function handleMinus() {
    updateQuantity(product.id, qty - 1);
  }

  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-[#e8e0d8] flex flex-col ${
        soldOut ? "opacity-60" : ""
      }`}
    >
      <div className="relative aspect-[4/3] bg-[#f5f0eb]">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 33vw"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder-food.jpg";
          }}
        />
        {soldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-[#1a1a1a] text-xs font-bold px-3 py-1 rounded-full">
              売り切れ
            </span>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-white/90 text-[#6b5e52] text-xs px-2 py-0.5 rounded-full font-medium">
          残り {product.stock}
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-[#1a1a1a] mb-0.5 line-clamp-2">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-[#6b5e52] mb-2 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between">
          <span className="text-base font-black text-[#1B3A6B]">{formatPrice(product.price)}</span>

          {qty === 0 ? (
            <button
              onClick={handleAdd}
              disabled={soldOut}
              className="w-8 h-8 bg-[#1B3A6B] text-white rounded-full flex items-center justify-center hover:bg-[#2E5BA8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-90"
            >
              <Plus size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleMinus}
                className="w-7 h-7 border-2 border-[#1B3A6B] text-[#1B3A6B] rounded-full flex items-center justify-center hover:bg-[#1B3A6B] hover:text-white transition-colors active:scale-90"
              >
                <Minus size={13} />
              </button>
              <span className="text-sm font-bold w-4 text-center">{qty}</span>
              <button
                onClick={handleAdd}
                disabled={qty >= product.stock}
                className="w-7 h-7 bg-[#1B3A6B] text-white rounded-full flex items-center justify-center hover:bg-[#2E5BA8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-90"
              >
                <Plus size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
