"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, UtensilsCrossed, ShoppingCart, User } from "lucide-react";
import { useBakeryStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/menu", label: "メニュー", icon: UtensilsCrossed },
  { href: "/cart", label: "カート", icon: ShoppingCart, showBadge: true },
  { href: "/mypage", label: "マイページ", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const getTotalItems = useBakeryStore((s) => s.getTotalItems);
  const totalItems = getTotalItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e8e0d8] safe-area-inset-bottom">
      <div className="max-w-3xl mx-auto flex">
        {navItems.map(({ href, label, icon: Icon, showBadge }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                isActive ? "text-[#8B1A2C]" : "text-[#6b5e52]"
              )}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {showBadge && totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#7EC8E3] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </div>
              <span className={cn("text-xs", isActive ? "font-bold" : "font-normal")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}