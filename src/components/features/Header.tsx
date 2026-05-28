"use client";

import Link from "next/link";
import { ShoppingCart, User, ChefHat } from "lucide-react";
import { useBakeryStore } from "@/lib/store";

export default function Header() {
  const getTotalItems = useBakeryStore((s) => s.getTotalItems);
  const totalItems = getTotalItems();

  return (
    <header className="sticky top-0 z-50 bg-[#8B1A2C] text-white shadow-md">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ChefHat size={22} className="text-[#c8843a]" />
          <span className="font-bold text-base tracking-wide">University Bakery</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/menu"
            className="text-sm font-medium hover:text-[#c8843a] transition-colors"
          >
            メニュー
          </Link>
          <Link
            href="/mypage"
            className="hover:text-[#c8843a] transition-colors"
            aria-label="マイページ"
          >
            <User size={20} />
          </Link>
          <Link
            href="/cart"
            className="relative hover:text-[#c8843a] transition-colors"
            aria-label="カート"
          >
            <ShoppingCart size={20} />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#c8843a] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
