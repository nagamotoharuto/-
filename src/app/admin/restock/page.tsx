"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, RefreshCw, Printer, AlertTriangle } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import StaffHeader from "@/components/features/StaffHeader";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  isAvailable: boolean;
}

interface OrderItem {
  quantity: number;
  price: number;
  product: { id: string; name: string; category: string };
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

interface RestockRow {
  id: string;
  name: string;
  category: string;
  soldQty: number;
  soldRevenue: number;
  stock: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  bread: "パン",
  drink: "ドリンク",
  goods: "グッズ",
};

const CATEGORY_ORDER = ["bread", "drink", "goods"];

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function RestockPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
      return;
    }
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    const [productsRes, ordersRes] = await Promise.all([
      fetch("/api/inventory"),
      fetch("/api/orders"),
    ]);
    const productsData = await productsRes.json();
    const ordersData = await ordersRes.json();
    setProducts(Array.isArray(productsData) ? productsData : []);
    setOrders(Array.isArray(ordersData) ? ordersData : []);
    setLoading(false);
  }

  const todaySoldOrders = orders.filter((o) => isToday(o.createdAt) && o.status !== "cancelled");

  const salesByProduct = new Map<string, { qty: number; revenue: number }>();
  for (const order of todaySoldOrders) {
    for (const item of order.items) {
      const existing = salesByProduct.get(item.product.id);
      const amount = item.price * item.quantity;
      if (existing) {
        existing.qty += item.quantity;
        existing.revenue += amount;
      } else {
        salesByProduct.set(item.product.id, { qty: item.quantity, revenue: amount });
      }
    }
  }

  const rows: RestockRow[] = products.map((p) => {
    const sold = salesByProduct.get(p.id);
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      soldQty: sold?.qty ?? 0,
      soldRevenue: sold?.revenue ?? 0,
      stock: p.stock,
    };
  });

  const totalQty = rows.reduce((sum, r) => sum + r.soldQty, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.soldRevenue, 0);

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-1 print:hidden">
          <h1 className="font-black text-[#1a1a1a] text-lg flex items-center gap-2">
            <Truck size={18} className="text-[#8B1A2C]" />
            発注
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 text-xs text-[#6b5e52] bg-white rounded-lg px-3 py-2 border border-[#e8e0d8]"
            >
              <Printer size={12} />
              印刷する
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-1 text-xs text-[#6b5e52] bg-white rounded-lg px-3 py-2 border border-[#e8e0d8]"
            >
              <RefreshCw size={12} />
              更新
            </button>
          </div>
        </div>

        <p className="text-xs text-[#6b5e52] mb-4">
          {today} 時点の本日の販売実績です。この表を見て、明日の発注数を決めてください。
        </p>

        {loading ? (
          <div className="bg-white rounded-2xl h-64 animate-pulse border border-[#e8e0d8]" />
        ) : (
          <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f5f0eb] text-[#6b5e52] text-xs">
                    <th className="text-left font-bold px-4 py-3">商品名</th>
                    <th className="text-right font-bold px-4 py-3">本日の販売数</th>
                    <th className="text-right font-bold px-4 py-3">本日の売上</th>
                    <th className="text-right font-bold px-4 py-3">現在庫</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_ORDER.map((cat) => {
                    const catRows = rows
                      .filter((r) => r.category === cat)
                      .sort((a, b) => b.soldQty - a.soldQty);
                    if (catRows.length === 0) return null;
                    return (
                      <Fragment key={cat}>
                        <tr>
                          <td colSpan={4} className="px-4 pt-4 pb-1 text-xs font-black text-[#8B1A2C]">
                            {CATEGORY_LABELS[cat] ?? cat}
                          </td>
                        </tr>
                        {catRows.map((row, i) => (
                          <tr
                            key={row.id}
                            className={i % 2 === 1 ? "bg-[#fdf8f3]" : ""}
                          >
                            <td className="px-4 py-3 font-bold text-[#1a1a1a]">{row.name}</td>
                            <td className="px-4 py-3 text-right font-black text-[#1a1a1a]">
                              {row.soldQty}
                              <span className="text-xs font-normal text-[#6b5e52]">個</span>
                            </td>
                            <td className="px-4 py-3 text-right text-[#1a1a1a]">
                              {formatPrice(row.soldRevenue)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.stock === 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                  <AlertTriangle size={11} />
                                  在庫切れ
                                </span>
                              ) : (
                                <span className="font-bold text-[#1a1a1a]">
                                  {row.stock}
                                  <span className="text-xs font-normal text-[#6b5e52]">個</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#e8e0d8] bg-[#f5f0eb]">
                    <td className="px-4 py-3 font-black text-[#1a1a1a]">合計</td>
                    <td className="px-4 py-3 text-right font-black text-[#8B1A2C]">
                      {totalQty}
                      <span className="text-xs font-normal text-[#6b5e52]">個</span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-[#8B1A2C]">
                      {formatPrice(totalRevenue)}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
