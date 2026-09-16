"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Save,
  Package,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Pencil,
  X,
  Upload,
  ImageIcon,
  Plus,
  Minus,
  Clock,
  CalendarDays,
  Check,
  ImageOff,
} from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  cn,
  formatJstDateLabel,
  formatPrice,
  getNextBusinessDay,
  compareProducts,
  getReservableQty,
  getReservationRatio,
  getWalkInSharePercent,
  isWithinSalesHours,
  RESERVATION_RATIO,
  SUB_CATEGORIES,
  SUB_CATEGORY_LABELS,
  toJstDateString,
} from "@/lib/utils";
import StaffHeader from "@/components/features/StaffHeader";

interface Product {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  price: number;
  imageUrl: string;
  stock: number;
  isAvailable: boolean;
  description: string;
}

// 販売日ごとの発注数と、そこから決まる予約枠の状況
interface DailyFigures {
  isOffered: boolean;
  plannedQty: number;
  reservableQty: number;
  reservedQty: number;
  remainingQty: number;
  shelfQty: number | null;
  unfulfilledQty: number;
}

interface EditState {
  name: string;
  price: string;
  imageUrl: string;
  description: string;
  stock: number;
  isAvailable: boolean;
}

function toEditState(p: Product): EditState {
  return {
    name: p.name,
    price: String(p.price),
    imageUrl: p.imageUrl,
    description: p.description,
    stock: p.stock,
    isAvailable: p.isAvailable,
  };
}

function isDirty(p: Product, e: EditState): boolean {
  return (
    e.name !== p.name ||
    Number(e.price) !== p.price ||
    e.imageUrl !== p.imageUrl ||
    e.description !== p.description ||
    e.stock !== p.stock ||
    e.isAvailable !== p.isAvailable
  );
}

// ---- Image upload zone component ----
function ImageUploadZone({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewBroken, setPreviewBroken] = useState(false);

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "アップロード失敗");
      } else {
        setPreviewBroken(false);
        onUploaded(data.url);
      }
    } catch {
      setUploadError("通信エラーが発生しました");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div>
      {/* Current image preview */}
      {currentUrl && (
        <div className="relative w-full h-36 rounded-xl overflow-hidden bg-[#f5f0eb] mb-2">
          {previewBroken ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#c8bdb5]">
              <ImageOff size={22} />
              <span className="text-xs">写真を読み込めません。登録し直してください</span>
            </div>
          ) : (
            <Image
              src={currentUrl}
              alt="現在の写真"
              fill
              className="object-cover"
              sizes="100vw"
              onError={() => setPreviewBroken(true)}
            />
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs py-1 text-center">
            現在の写真
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          dragging
            ? "border-[#8B1A2C] bg-[#8B1A2C]/5"
            : "border-[#e8e0d8] hover:border-[#8B1A2C] hover:bg-[#8B1A2C]/5"
        }`}
      >
        {uploading ? (
          <>
            <div className="w-6 h-6 border-2 border-[#8B1A2C] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#6b5e52]">アップロード中...</p>
          </>
        ) : (
          <>
            <Upload size={22} className={dragging ? "text-[#8B1A2C]" : "text-[#6b5e52]"} />
            <p className="text-xs font-bold text-[#6b5e52] text-center">
              クリックまたはドラッグ＆ドロップ
            </p>
            <p className="text-xs text-[#6b5e52]">JPEG・PNG・WebP・GIF（5MBまで）</p>
          </>
        )}
      </div>

      {uploadError && (
        <p className="text-xs text-red-500 mt-1">{uploadError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}

// ---- Main page ----
export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "food", subCategory: "bread", price: "", imageUrl: "", stock: 0, description: "" });
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [stockUpdating, setStockUpdating] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [shelfCounts, setShelfCounts] = useState<Record<string, number>>({});
  // The bread line-up changes daily, so quantities are kept per sale date.
  // Staff set the next business day's figures the day before.
  const [saleDates] = useState<string[]>(() => [toJstDateString(), getNextBusinessDay()]);
  const [saleDate, setSaleDate] = useState(() => toJstDateString());
  const [daily, setDaily] = useState<Record<string, DailyFigures>>({});
  const [dailyLoading, setDailyLoading] = useState(true);
  const [plannedSavedId, setPlannedSavedId] = useState<string | null>(null);
  const [shelfBusy, setShelfBusy] = useState<string | null>(null);
  // 読み込めなかったサムネイルは壊れたアイコンではなく枠を出す
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});
  const [dailyReloadKey, setDailyReloadKey] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
      return;
    }
    loadProducts();

    fetch("/api/shelf-count")
      .then((r) => r.json())
      .then((data: { items?: { id: string; count: number }[] }) => {
        const map: Record<string, number> = {};
        for (const item of data.items ?? []) map[item.id] = item.count;
        setShelfCounts(map);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/daily-stock?date=${encodeURIComponent(saleDate)}`)
      .then((r) => r.json())
      .then((data: { items?: (DailyFigures & { id: string })[] }) => {
        if (cancelled) return;
        const map: Record<string, DailyFigures> = {};
        for (const item of data.items ?? []) {
          map[item.id] = {
            isOffered: item.isOffered,
            plannedQty: item.plannedQty,
            reservableQty: item.reservableQty,
            reservedQty: item.reservedQty,
            remainingQty: item.remainingQty,
            shelfQty: item.shelfQty,
            unfulfilledQty: item.unfulfilledQty,
          };
        }
        setDaily(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDailyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [saleDate, dailyReloadKey]);

  function selectSaleDate(next: string) {
    if (next === saleDate) return;
    setDailyLoading(true);
    setSaleDate(next);
  }

  /**
   * 入力中の発注数から予約枠をその場で計算し直す。
   * 保存を待たずに数字が出るので、何個予約枠になるかを見ながら発注数を決められる。
   */
  function previewPlannedQty(productId: string, plannedQty: number) {
    const safe = Math.max(0, plannedQty);
    const product = products.find((p) => p.id === productId);
    const reservable = getReservableQty(safe, product);

    setDaily((prev) => {
      const current = prev[productId];
      const reserved = current?.reservedQty ?? 0;
      return {
        ...prev,
        [productId]: {
          isOffered: safe > 0,
          plannedQty: safe,
          reservableQty: reservable,
          reservedQty: reserved,
          remainingQty: Math.max(0, reservable - reserved),
          // 店頭在庫は発注数と同じ数から始まる。まだ決まっていなければ追随させる。
          shelfQty: current?.shelfQty ?? safe,
          unfulfilledQty: current?.unfulfilledQty ?? 0,
        },
      };
    });
  }

  // 発注数はその販売日の予約枠(70%)の基準になる。0ならその日は販売しない。
  async function savePlannedQty(productId: string, plannedQty: number) {
    const safe = Math.max(0, plannedQty);
    previewPlannedQty(productId, safe);

    const res = await fetch("/api/daily-stock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, date: saleDate, plannedQty: safe }),
    });

    if (!res.ok) {
      setDailyReloadKey((k) => k + 1);
      return;
    }
    setPlannedSavedId(productId);
    setTimeout(
      () => setPlannedSavedId((current) => (current === productId ? null : current)),
      1500
    );
    // 店頭在庫の初期化はサーバー側で行うので、保存後の値を取り直す
    setDailyReloadKey((k) => k + 1);
  }

  /**
   * 店頭在庫を1つ動かす。飛び込み客に売れたら「−1」、数え間違いは「+1」で戻す。
   * 発注数と同じ数から始まり、ここで減った分が飛び込み販売数になる。
   */
  async function adjustShelfQty(productId: string, delta: number) {
    if (shelfBusy) return;
    setShelfBusy(productId);

    setDaily((prev) => {
      const current = prev[productId];
      if (!current) return prev;
      const base = current.shelfQty ?? current.plannedQty;
      return { ...prev, [productId]: { ...current, shelfQty: Math.max(0, base + delta) } };
    });

    try {
      const res = await fetch("/api/daily-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, date: saleDate, shelfDelta: delta }),
      });
      if (!res.ok) setDailyReloadKey((k) => k + 1);
    } catch {
      setDailyReloadKey((k) => k + 1);
    } finally {
      setShelfBusy(null);
    }
  }

  // 数え違いのリセット用。発注数と同じ数に戻す。
  async function resyncShelfQty(productId: string, plannedQty: number) {
    setShelfBusy(productId);
    try {
      await fetch("/api/daily-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, date: saleDate, shelfQty: plannedQty }),
      });
    } finally {
      setShelfBusy(null);
      setDailyReloadKey((k) => k + 1);
    }
  }

  const businessOpen = isWithinSalesHours(now);
  // 店頭の実在庫を触れるのは当日タブのときだけ
  const isTodayTab = saleDate === toJstDateString(now);

  async function loadProducts() {
    setLoading(true);
    const res = await fetch("/api/inventory");
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function getEdit(product: Product): EditState {
    return edits[product.id] ?? toEditState(product);
  }

  function updateEdit(id: string, field: keyof EditState, value: string | number | boolean) {
    const product = products.find((p) => p.id === id)!;
    setEdits((prev) => ({ ...prev, [id]: { ...getEdit(product), [field]: value } }));
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function adjustStock(product: Product, delta: number) {
    const nextStock = Math.max(0, product.stock + delta);
    if (nextStock === product.stock || stockUpdating) return;

    setStockUpdating(product.id);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: nextStock } : p)));

    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, stock: nextStock }),
    });

    if (!res.ok) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: product.stock } : p)));
    }
    setStockUpdating(null);
  }

  function cancelEdit(product: Product) {
    setEdits((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
    setErrors((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
    setExpanded((prev) => ({ ...prev, [product.id]: false }));
  }

  async function saveProduct(product: Product) {
    const edit = getEdit(product);

    if (!edit.name.trim()) {
      setErrors((prev) => ({ ...prev, [product.id]: "商品名を入力してください" }));
      return;
    }
    const priceNum = Number(edit.price);
    if (!edit.price || isNaN(priceNum) || priceNum <= 0) {
      setErrors((prev) => ({ ...prev, [product.id]: "正しい金額を入力してください" }));
      return;
    }
    if (!edit.imageUrl.trim()) {
      setErrors((prev) => ({ ...prev, [product.id]: "写真をアップロードしてください" }));
      return;
    }

    setSaving(product.id);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: edit.name,
        price: priceNum,
        imageUrl: edit.imageUrl,
        description: edit.description,
        stock: edit.stock,
        isAvailable: edit.isAvailable,
      }),
    });
    setSaving(null);

    if (!res.ok) {
      const data = await res.json();
      setErrors((prev) => ({ ...prev, [product.id]: data.error ?? "保存に失敗しました" }));
      return;
    }

    setEdits((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
    setExpanded((prev) => ({ ...prev, [product.id]: false }));
    loadProducts();
  }

  async function createProduct() {
    if (!newProduct.name.trim()) { setAddError("商品名を入力してください"); return; }
    const priceNum = Number(newProduct.price);
    if (!newProduct.price || isNaN(priceNum) || priceNum <= 0) { setAddError("正しい金額を入力してください"); return; }
    setAddSaving(true);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newProduct.name.trim(),
        category: newProduct.category,
        subCategory: newProduct.subCategory,
        price: priceNum,
        imageUrl: newProduct.imageUrl,
        stock: newProduct.stock,
        description: newProduct.description,
      }),
    });
    setAddSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error ?? "保存に失敗しました");
      return;
    }
    setShowAddForm(false);
    setNewProduct({ name: "", category: "food", subCategory: "bread", price: "", imageUrl: "", stock: 0, description: "" });
    setAddError("");
    loadProducts();
  }

  const categories = CATEGORIES;

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-black text-[#1a1a1a] text-lg flex items-center gap-2">
              <Package size={18} className="text-[#8B1A2C]" />
              商品・在庫管理
            </h1>
            <p className="text-xs text-[#6b5e52] mt-1">
              商品名・金額・写真は全日共通です。発注数は販売日ごとに設定します
            </p>
          </div>
          <button
            onClick={loadProducts}
            className="flex-shrink-0 flex items-center gap-1 text-xs text-[#6b5e52] bg-white rounded-lg px-3 py-2 border border-[#e8e0d8]"
          >
            <RefreshCw size={12} />
            更新
          </button>
        </div>

        {/* Sale date tabs — the bread line-up and quantities differ per day */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-4">
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#6b5e52] mb-2">
            <CalendarDays size={14} />
            編集する販売日
          </label>
          <div className="flex gap-2 mb-2">
            {saleDates.map((d) => (
              <button
                key={d}
                onClick={() => selectSaleDate(d)}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors",
                  saleDate === d
                    ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                    : "bg-white text-[#6b5e52] border-[#e8e0d8] hover:border-[#8B1A2C]"
                )}
              >
                {formatJstDateLabel(d)}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#6b5e52]">
            発注数の{Math.round(RESERVATION_RATIO * 100)}%が予約枠になり、
            残り{Math.round((1 - RESERVATION_RATIO) * 100)}%は飛び込みのお客様用に店頭へ確保されます。
            <strong className="text-[#8B1A2C]">お菓子だけは全量が予約枠</strong>
            になります（種類が多く1種あたりの個数が少ないため）。
            <strong className="text-[#8B1A2C]">発注数が0の商品は、その日のメニューに表示されません。</strong>
          </p>
        </div>

        {/* Business hours banner */}
        <div
          className={`flex items-center gap-2 rounded-2xl px-4 py-3 mb-4 text-xs font-bold ${
            businessOpen
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-gray-100 border border-gray-300 text-gray-600"
          }`}
        >
          <Clock size={14} />
          {businessOpen
            ? "店頭営業中（平日11:00〜15:00）：本日分のご予約を受付中です"
            : "店頭は営業時間外です：次の営業日分のご予約を受付中です（予約受付は24時間稼働します）"}
        </div>

        {/* Add new product */}
        <div className="mb-6">
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddError(""); }}
            className="w-full flex items-center justify-center gap-2 bg-[#8B1A2C] text-white rounded-2xl py-3 font-bold text-sm hover:bg-[#A52235] transition-colors"
          >
            <Plus size={16} />
            新しい商品を追加
          </button>

          {showAddForm && (
            <div className="mt-3 bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 flex flex-col gap-3">
              <p className="text-sm font-bold text-[#1a1a1a]">新規商品登録</p>

              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-2">{addError}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">商品名</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => { setNewProduct(p => ({ ...p, name: e.target.value })); setAddError(""); }}
                  maxLength={50}
                  placeholder="例：あんパン"
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">売り場</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              {/* 図鑑・購入上限・スタンプ特典・AIカウントはパンだけが対象なので内訳を持つ */}
              {newProduct.category === "food" && (
                <div>
                  <label className="block text-xs font-bold text-[#6b5e52] mb-1">内訳</label>
                  <select
                    value={newProduct.subCategory}
                    onChange={(e) => setNewProduct(p => ({ ...p, subCategory: e.target.value }))}
                    className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                  >
                    {SUB_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{SUB_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#6b5e52] mt-1">
                    パンだけが図鑑・購入上限・スタンプ特典・AIカウントの対象になります
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">金額（円）</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b5e52]">¥</span>
                  <input
                    type="number"
                    min={1}
                    max={99999}
                    value={newProduct.price}
                    onChange={(e) => { setNewProduct(p => ({ ...p, price: e.target.value })); setAddError(""); }}
                    className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 pl-7 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1 flex items-center gap-1">
                  <ImageIcon size={12} />
                  写真
                </label>
                <ImageUploadZone
                  currentUrl={newProduct.imageUrl}
                  onUploaded={(url) => setNewProduct(p => ({ ...p, imageUrl: url }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">説明文</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct(p => ({ ...p, description: e.target.value }))}
                  maxLength={100}
                  rows={2}
                  placeholder="商品の説明を入力（任意）"
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">初期在庫数</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct(p => ({ ...p, stock: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddForm(false); setAddError(""); setNewProduct({ name: "", category: "food", subCategory: "bread", price: "", imageUrl: "", stock: 0, description: "" }); }}
                  className="flex-1 border border-[#e8e0d8] text-[#6b5e52] rounded-xl py-2.5 text-sm font-bold hover:bg-[#f5f0eb] transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={createProduct}
                  disabled={addSaving}
                  className="flex-1 bg-[#8B1A2C] text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1 hover:bg-[#A52235] transition-colors disabled:opacity-60"
                >
                  <Save size={14} />
                  {addSaving ? "保存中..." : "追加する"}
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl h-24 animate-pulse border border-[#e8e0d8]"
              />
            ))}
          </div>
        ) : (
          categories.map((cat) => {
            // パンを上、お菓子を下にして、それぞれ名前順
            const catProducts = products.filter((p) => p.category === cat).sort(compareProducts);
            if (catProducts.length === 0) return null;
            return (
              <div key={cat} className="mb-6">
                <h2 className="font-bold text-[#1a1a1a] mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-[#8B1A2C] rounded-full inline-block" />
                  {CATEGORY_LABELS[cat]}
                </h2>
                <div className="flex flex-col gap-3">
                  {catProducts.map((product) => {
                    const edit = getEdit(product);
                    const dirty = isDirty(product, edit);
                    const isOpen = expanded[product.id] ?? false;
                    const err = errors[product.id];
                    // 「販売中/停止中」は商品マスタ側の設定。店頭の営業時間とは切り離す
                    // （予約受付は営業時間外も続くため）
                    const effectiveAvailable = edit.isAvailable;
                    const figures: DailyFigures = daily[product.id] ?? {
                      isOffered: false,
                      plannedQty: 0,
                      reservableQty: 0,
                      reservedQty: 0,
                      remainingQty: 0,
                      shelfQty: null,
                      unfulfilledQty: 0,
                    };
                    // 店頭在庫が未設定なら発注数と同じ数から始まる
                    const shelfQty = figures.shelfQty ?? figures.plannedQty;
                    // 店頭で売り続けると予約分が足りなくなる状態
                    const shelfShort =
                      figures.plannedQty > 0 && shelfQty < figures.unfulfilledQty;

                    return (
                      <div
                        key={product.id}
                        className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden"
                      >
                        {/* Collapsed row */}
                        <div className="p-4 flex items-center gap-3">
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#f5f0eb]">
                            {edit.imageUrl && !brokenThumbs[product.id] ? (
                              <Image
                                src={edit.imageUrl}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="64px"
                                onError={() =>
                                  setBrokenThumbs((prev) => ({ ...prev, [product.id]: true }))
                                }
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-[#c8bdb5]">
                                <ImageOff size={18} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1a1a1a] truncate">
                              {edit.name}
                            </p>
                            <p className="text-xs text-[#6b5e52]">
                              {formatPrice(Number(edit.price) || product.price)}
                            </p>
                            <div className="flex flex-col gap-2 mt-2">
                              {/* 発注数：入力すると予約枠がその場で計算される */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-[#6b5e52] w-12">発注数</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={figures.plannedQty}
                                  disabled={dailyLoading}
                                  onChange={(e) =>
                                    previewPlannedQty(
                                      product.id,
                                      Math.max(0, parseInt(e.target.value, 10) || 0)
                                    )
                                  }
                                  onBlur={(e) =>
                                    savePlannedQty(
                                      product.id,
                                      Math.max(0, parseInt(e.target.value, 10) || 0)
                                    )
                                  }
                                  className="w-16 border border-[#e8e0d8] rounded-lg px-2 py-1 text-right text-sm font-black bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] disabled:opacity-50"
                                />
                                {plannedSavedId === product.id && (
                                  <Check size={14} className="text-green-600" />
                                )}
                                {figures.plannedQty === 0 ? (
                                  <span className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full">
                                    この日は販売しない
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#6b5e52] bg-[#f5f0eb] px-2 py-0.5 rounded-full">
                                    予約枠
                                    <strong className="text-[#8B1A2C] mx-0.5">
                                      {figures.reservableQty}
                                    </strong>
                                    <span className="text-[#8d8073]">
                                      （
                                      {getWalkInSharePercent(product) === 0
                                        ? "全量"
                                        : `${Math.round(getReservationRatio(product) * 100)}%`}
                                      ）
                                    </span>
                                    ／予約済{figures.reservedQty}／残り
                                    <strong
                                      className={
                                        figures.remainingQty === 0
                                          ? "text-red-600 ml-0.5"
                                          : "text-[#8B1A2C] ml-0.5"
                                      }
                                    >
                                      {figures.remainingQty}
                                    </strong>
                                  </span>
                                )}
                              </div>

                              {/* 店頭在庫：飛び込み客に売れたら「−1」で減らす（本日のみ） */}
                              {isTodayTab && figures.plannedQty > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-[#6b5e52] w-12">店頭</span>
                                  <button
                                    onClick={() => adjustShelfQty(product.id, -1)}
                                    disabled={shelfQty <= 0 || shelfBusy === product.id}
                                    className="flex items-center gap-1 h-8 px-3 rounded-lg bg-[#8B1A2C] text-white text-xs font-bold hover:bg-[#A52235] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Minus size={13} />
                                    1個売れた
                                  </button>
                                  <span className="text-base font-black text-[#1a1a1a] w-8 text-center">
                                    {shelfQty}
                                  </span>
                                  <button
                                    onClick={() => adjustShelfQty(product.id, 1)}
                                    disabled={shelfBusy === product.id}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e0d8] text-[#8B1A2C] hover:bg-[#f5f0eb] disabled:opacity-30 transition-colors"
                                    aria-label="店頭在庫を1つ戻す"
                                  >
                                    <Plus size={13} />
                                  </button>
                                  {shelfQty !== figures.plannedQty && (
                                    <button
                                      onClick={() => resyncShelfQty(product.id, figures.plannedQty)}
                                      disabled={shelfBusy === product.id}
                                      className="text-[10px] text-[#6b5e52] underline hover:text-[#8B1A2C] disabled:opacity-40"
                                    >
                                      発注数に戻す
                                    </button>
                                  )}
                                  {product.subCategory === "bread" &&
                                    shelfCounts[product.id] !== undefined && (
                                      <span className="text-[10px] text-[#6b5e52] bg-[#f5f0eb] px-2 py-0.5 rounded-full">
                                        AIカウント {shelfCounts[product.id]}個
                                      </span>
                                    )}
                                </div>
                              )}

                              {/* 予約分まで売ってしまう手前で警告する */}
                              {isTodayTab && shelfShort && (
                                <p className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                  店頭在庫 {shelfQty} 個に対して、未受け渡しの予約が{" "}
                                  {figures.unfulfilledQty} 個あります。これ以上店頭で売ると予約分が不足します
                                </p>
                              )}

                              {/* 販売の停止・再開（日付に関係なく商品そのものの設定） */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <button
                                  onClick={() =>
                                    updateEdit(product.id, "isAvailable", !edit.isAvailable)
                                  }
                                  className="flex items-center gap-0.5"
                                >
                                  {effectiveAvailable ? (
                                    <ToggleRight size={20} className="text-[#8B1A2C]" />
                                  ) : (
                                    <ToggleLeft size={20} className="text-[#e8e0d8]" />
                                  )}
                                  <span
                                    className={`text-xs font-bold ${
                                      effectiveAvailable ? "text-[#8B1A2C]" : "text-[#6b5e52]"
                                    }`}
                                  >
                                    {effectiveAvailable ? "販売中" : "停止中"}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                              onClick={() => toggleExpand(product.id)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                isOpen
                                  ? "bg-[#f5f0eb] text-[#6b5e52] border-[#e8e0d8]"
                                  : "bg-white text-[#8B1A2C] border-[#8B1A2C] hover:bg-[#8B1A2C] hover:text-white"
                              }`}
                            >
                              {isOpen ? <X size={12} /> : <Pencil size={12} />}
                              {isOpen ? "閉じる" : "編集"}
                            </button>
                            {dirty && !isOpen && (
                              <button
                                onClick={() => saveProduct(product)}
                                disabled={saving === product.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#8B1A2C] text-white rounded-xl text-xs font-bold hover:bg-[#A52235] transition-colors disabled:opacity-60"
                              >
                                <Save size={12} />
                                {saving === product.id ? "保存中" : "保存"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded edit form */}
                        {isOpen && (
                          <div className="border-t border-[#e8e0d8] bg-[#fdf8f3] p-4 flex flex-col gap-3">
                            <p className="text-xs font-bold text-[#6b5e52]">商品情報を編集</p>

                            {err && (
                              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-2">
                                {err}
                              </div>
                            )}

                            {/* Name */}
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">
                                商品名
                              </label>
                              <input
                                type="text"
                                value={edit.name}
                                onChange={(e) => updateEdit(product.id, "name", e.target.value)}
                                maxLength={50}
                                className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                              />
                            </div>

                            {/* Price */}
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">
                                金額（円）
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b5e52]">
                                  ¥
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={99999}
                                  value={edit.price}
                                  onChange={(e) =>
                                    updateEdit(product.id, "price", e.target.value)
                                  }
                                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 pl-7 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                                />
                              </div>
                            </div>

                            {/* Image upload */}
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1 flex items-center gap-1">
                                <ImageIcon size={12} />
                                写真
                              </label>
                              <ImageUploadZone
                                currentUrl={edit.imageUrl}
                                onUploaded={(url) => updateEdit(product.id, "imageUrl", url)}
                              />
                            </div>

                            {/* Description */}
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">
                                説明文
                              </label>
                              <textarea
                                value={edit.description}
                                onChange={(e) =>
                                  updateEdit(product.id, "description", e.target.value)
                                }
                                maxLength={100}
                                rows={2}
                                className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white resize-none"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => cancelEdit(product)}
                                className="flex-1 border border-[#e8e0d8] text-[#6b5e52] rounded-xl py-2.5 text-sm font-bold hover:bg-[#f5f0eb] transition-colors"
                              >
                                キャンセル
                              </button>
                              <button
                                onClick={() => saveProduct(product)}
                                disabled={saving === product.id || !dirty}
                                className="flex-1 bg-[#8B1A2C] text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1 hover:bg-[#A52235] transition-colors disabled:opacity-60"
                              >
                                <Save size={14} />
                                {saving === product.id ? "保存中..." : "保存する"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}