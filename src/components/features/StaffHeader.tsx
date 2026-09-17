"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChefHat, Store, Package, CalendarDays, Home, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

// 日常の操作は「今日の販売」だけで完結する。商品と発注数の用意、
// 過去の記録はそれぞれ別の場面なので分けている。
const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "今日の販売", icon: Store },
  { href: "/admin/inventory", label: "商品・発注", icon: Package },
  { href: "/admin/records", label: "記録", icon: CalendarDays },
];

export default function StaffHeader() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    sessionStorage.removeItem("staff_auth");
    router.push("/admin");
  }

  return (
    <header className="bg-[#8B1A2C] text-white print:hidden sticky top-0 z-40">
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={18} className="text-[#F0AA5A]" />
          <span className="font-bold text-sm">スタッフ画面</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs text-[#F5C0C8] hover:text-white flex items-center gap-1">
            <Home size={14} />
            ホーム
          </Link>
          <button
            onClick={logout}
            className="text-xs text-[#F5C0C8] hover:text-white flex items-center gap-1"
          >
            <LogOut size={14} />
            ログアウト
          </button>
        </div>
      </div>
      <nav className="flex bg-[#7A1726]">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-bold border-b-2 transition-colors",
                active
                  ? "border-[#F0AA5A] text-white"
                  : "border-transparent text-[#F5C0C8] hover:text-white"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
