"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChefHat, ClipboardList, Package, Truck, Home, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "注文・売上", icon: ClipboardList },
  { href: "/admin/inventory", label: "商品・在庫", icon: Package },
  { href: "/admin/restock", label: "発注", icon: Truck },
];

export default function StaffHeader() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    sessionStorage.removeItem("staff_auth");
    router.push("/admin");
  }

  return (
    <header className="bg-[#8B1A2C] text-white print:hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={20} className="text-[#F0AA5A]" />
          <span className="font-bold text-sm">スタッフ管理画面</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs text-[#F5C0C8] hover:text-white flex items-center gap-1">
            <Home size={14} />
            ホーム
          </Link>
          <button onClick={logout} className="text-xs text-[#F5C0C8] hover:text-white flex items-center gap-1">
            <LogOut size={14} />
            ログアウト
          </button>
        </div>
      </div>
      <nav className="flex bg-[#7A1726] px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
                active
                  ? "border-[#F0AA5A] text-white"
                  : "border-transparent text-[#F5C0C8] hover:text-white"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
